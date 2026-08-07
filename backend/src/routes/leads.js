/**
 * Leads Routes
 * Lead generation, scraping, and enrichment
 * POST /api/leads/scrape - Trigger web scraping for leads
 * GET /api/leads/status/:merchantId - Check scraping job status
 */

const express = require('express');
const router = express.Router();
const Merchant = require('../models/Merchant');
const Contact = require('../models/Contact');
const ActivityLog = require('../models/ActivityLog');

// In-memory job tracking (use Redis in production)
const scrapingJobs = new Map();

/**
 * POST /api/leads/scrape
 * Trigger online lead scraping for a merchant
 * Body: { merchantId, location, industry, limit }
 *
 * Rate limited to 1 scrape per hour per merchant
 */
router.post('/scrape', async (req, res) => {
  try {
    const { merchantId, location, industry, limit = 50 } = req.body;

    // ==========================================
    // VALIDATION
    // ==========================================
    if (!merchantId || !location || !industry) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['merchantId', 'location', 'industry'],
      });
    }

    if (typeof limit !== 'number' || limit < 1 || limit > 200) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 200',
      });
    }

    // ==========================================
    // AUTHORIZATION
    // ==========================================
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    console.log(`🔍 Lead scraping request from ${merchant.name}`);

    // ==========================================
    // RATE LIMITING
    // ==========================================
    const lastScrape = await ActivityLog.findOne({
      merchantId,
      action: 'LEAD_SCRAPING_TRIGGERED',
      status: { $in: ['Success', 'InProgress'] },
    }).sort({ createdAt: -1 });

    if (lastScrape) {
      const hourAgo = Date.now() - 3600000;
      if (lastScrape.createdAt.getTime() > hourAgo) {
        const minutesLeft = Math.ceil((3600000 - (Date.now() - lastScrape.createdAt.getTime())) / 60000);
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `You can scrape leads again in ${minutesLeft} minutes`,
          nextAvailable: new Date(lastScrape.createdAt.getTime() + 3600000),
        });
      }
    }

    // ==========================================
    // INPUT SANITIZATION
    // ==========================================
    const sanitizedLocation = location.trim().slice(0, 100);
    const sanitizedIndustry = industry.trim().slice(0, 100);

    // ==========================================
    // CREATE SCRAPING JOB
    // ==========================================
    const jobId = `${merchantId}-${Date.now()}`;
    const job = {
      jobId,
      merchantId,
      location: sanitizedLocation,
      industry: sanitizedIndustry,
      limit,
      status: 'Queued',
      startedAt: new Date(),
      completedAt: null,
      leadsFound: 0,
      leadsAdded: 0,
      error: null,
    };

    // Store job in memory
    scrapingJobs.set(jobId, job);

    // Log activity
    await ActivityLog.create({
      merchantId,
      action: 'LEAD_SCRAPING_TRIGGERED',
      entityType: 'Contact',
      details: {
        location: sanitizedLocation,
        industry: sanitizedIndustry,
        limit,
        jobId,
      },
      status: 'InProgress',
    });

    console.log(`✓ Scraping job created: ${jobId}`);

    // ==========================================
    // TRIGGER ASYNC SCRAPING (NON-BLOCKING)
    // ==========================================
    triggerLeadScraping(jobId, merchantId, sanitizedLocation, sanitizedIndustry, limit).catch(
      err => {
        console.error(`Error in scraping job ${jobId}:`, err);
        job.error = err.message;
        job.status = 'Failed';
        scrapingJobs.set(jobId, job);
      }
    );

    // Return immediately
    return res.status(202).json({
      success: true,
      message: 'Lead scraping started',
      jobId,
      status: 'Queued',
      estimatedTime: '2-5 minutes',
    });
  } catch (error) {
    console.error('Error starting lead scraping:', error);
    return res.status(500).json({ error: 'Failed to start scraping' });
  }
});

/**
 * GET /api/leads/status/:jobId
 * Check scraping job status
 */
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = scrapingJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      success: true,
      job: {
        jobId: job.jobId,
        status: job.status,
        progress: {
          found: job.leadsFound,
          added: job.leadsAdded,
          limit: job.limit,
          percentage: Math.round((job.leadsAdded / job.limit) * 100),
        },
        timing: {
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          duration: job.completedAt
            ? Math.round((job.completedAt - job.startedAt) / 1000)
            : null,
        },
        error: job.error,
      },
    });
  } catch (error) {
    console.error('Error checking job status:', error);
    return res.status(500).json({ error: 'Failed to check job status' });
  }
});

/**
 * GET /api/leads/scraped/:merchantId
 * Get all scraped leads for a merchant
 */
router.get('/scraped/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const leads = await Contact.find({
      merchantId,
      source: 'scraper',
    })
      .select('firstName lastName phone email company status')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 500))
      .skip(parseInt(skip));

    const total = await Contact.countDocuments({
      merchantId,
      source: 'scraper',
    });

    console.log(`✓ Retrieved ${leads.length} scraped leads`);

    return res.json({
      success: true,
      leads: leads.map(l => ({
        id: l._id,
        name: `${l.firstName} ${l.lastName}`,
        phone: l.phone,
        email: l.email,
        company: l.company,
        status: l.status,
      })),
      pagination: {
        total,
        limit: Math.min(parseInt(limit), 500),
        skip: parseInt(skip),
        pages: Math.ceil(total / Math.min(parseInt(limit), 500)),
      },
    });
  } catch (error) {
    console.error('Error fetching scraped leads:', error);
    return res.status(500).json({ error: 'Failed to fetch scraped leads' });
  }
});

/**
 * Private: Trigger async lead scraping
 * TODO: Implement actual web scraping logic
 */
async function triggerLeadScraping(jobId, merchantId, location, industry, limit) {
  try {
    const job = scrapingJobs.get(jobId);
    if (!job) return;

    job.status = 'InProgress';
    console.log(`🔄 Starting scraping for ${location}, ${industry}...`);

    // ==========================================
    // TODO: IMPLEMENT ACTUAL SCRAPING
    // ==========================================
    // This is where you would:
    // 1. Call web scraping APIs (e.g., ScraperAPI, Bright Data)
    // 2. Search for businesses in location + industry
    // 3. Extract contact info (phone, email, etc.)
    // 4. Enrich data with additional info
    // 5. Save to MongoDB

    // For now, simulate with mock data
    const mockLeads = generateMockLeads(location, industry, limit);

    for (const lead of mockLeads) {
      try {
        const existingLead = await Contact.findOne({
          phone: lead.phone,
          merchantId,
        });

        if (!existingLead) {
          await Contact.create({
            merchantId,
            firstName: lead.firstName,
            lastName: lead.lastName,
            phone: lead.phone,
            email: lead.email || '',
            company: lead.company,
            source: 'scraper',
            status: 'Active',
          });

          job.leadsAdded++;
        }

        job.leadsFound++;
      } catch (err) {
        console.warn(`Error saving lead ${lead.phone}:`, err.message);
      }
    }

    job.status = 'Completed';
    job.completedAt = new Date();

    console.log(`✓ Scraping completed: ${job.leadsAdded} new leads added`);

    // Log completion
    await ActivityLog.create({
      merchantId,
      action: 'LEAD_SCRAPING_COMPLETED',
      entityType: 'Contact',
      details: {
        jobId,
        leadsFound: job.leadsFound,
        leadsAdded: job.leadsAdded,
        location,
        industry,
      },
      status: 'Success',
    });

    scrapingJobs.set(jobId, job);
  } catch (error) {
    console.error(`Error in scraping job ${jobId}:`, error);
    const job = scrapingJobs.get(jobId);
    if (job) {
      job.status = 'Failed';
      job.error = error.message;
      job.completedAt = new Date();
      scrapingJobs.set(jobId, job);
    }
  }
}

/**
 * Private: Generate mock leads for testing
 * TODO: Replace with actual scraping logic
 */
function generateMockLeads(location, industry, limit) {
  const firstNames = ['Chioma', 'Emeka', 'Zainab', 'Ahmed', 'Fatima', 'Kwesi', 'Amara'];
  const lastNames = ['Okafor', 'Silva', 'Hassan', 'Mensah', 'Patel', 'Adewale', 'Obi'];
  const companies = [
    `${industry} Co`,
    `${industry} Ltd`,
    `${industry} Solutions`,
    `Prime ${industry}`,
    `${industry} Hub`,
  ];

  const leads = [];
  for (let i = 0; i < Math.min(limit, 20); i++) {
    leads.push({
      firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
      phone: `+234${Math.floor(Math.random() * 900000000 + 100000000)}`,
      email: `contact${i}@${company.toLowerCase().replace(/ /g, '')}.com`,
      company: companies[Math.floor(Math.random() * companies.length)],
    });
  }
  return leads;
}

module.exports = router;
