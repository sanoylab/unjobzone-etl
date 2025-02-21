const e = require("express");
const { Pool } = require("pg");
require("dotenv").config();
const { credentials } = require("./db");

const pool = new Pool(credentials);

// Post expiring soon jobs to LinkedIn
module.exports.postExpiringSoonJobPostsToLinkedIn = async () => {
  try {
    // Validate LinkedIn credentials first
    validateLinkedInCredentials();

    // Get job posts where end_date is today or tomorrow and from different organizations
    const queryDistinct = `
      SELECT DISTINCT ON (organization_id)
        id, 
        job_id, 
        job_title,
        duty_station,
        job_level,
        apply_link,
        created,
        end_date,
        organization_id
      FROM 
        public.job_vacancies
      WHERE 
        end_date = CURRENT_DATE OR end_date = CURRENT_DATE + INTERVAL '1 day'
      ORDER BY organization_id, created DESC
      LIMIT 5
    `;

    const resultDistinct = await pool.query(queryDistinct);
    let jobPosts = resultDistinct.rows;

    // If less than 5 records, fill in with jobs from any organization
    if (jobPosts.length < 5) {
      const remainingSlots = 5 - jobPosts.length;
      const queryFill = `
        SELECT 
          id, 
          job_id, 
          job_title,
          duty_station,
          job_level,
          apply_link,
          created,
          end_date,
          organization_id
        FROM 
          public.job_vacancies
        WHERE 
          end_date = CURRENT_DATE OR end_date = CURRENT_DATE + INTERVAL '1 day'
        ORDER BY created DESC
        LIMIT ${remainingSlots}
      `;

      const resultFill = await pool.query(queryFill);
      jobPosts = jobPosts.concat(resultFill.rows);
    }

    if (!jobPosts.length) {
      console.log("No job posts found to share");
      return;
    }

    // Format message with emojis and proper spacing
    let message = "⏳ Hurry up! These job opportunities are about to expire soon:\n\n";
    jobPosts.forEach(job => {
      message += `📌 ${job.job_title}\n`;
      message += `📍 ${job.duty_station}\n`;
      message += `🔗 Apply: https://www.unjobzone.com/job/${job.id}\n\n`;
    });
    message += "#UnitedNations #jobs #unjobs #careers #hiring #jobsearch #unjobzone #UN";
    
    // Validate and format organization ID
    const organizationId = process.env.LINKEDIN_ORGANIZATION_ID?.toString().trim();
    if (!organizationId || isNaN(organizationId)) {
      throw new Error('Invalid LinkedIn Organization ID');
    }

    // Verify access token exists and isn't expired
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new Error('Missing or invalid LinkedIn access token');
    }

    // Create LinkedIn share with verified author URN
    const authorUrn = `urn:li:organization:${organizationId}`;

    const url = "https://api.linkedin.com/v2/ugcPosts";
    const payload = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: message
          },
          shareMediaCategory: "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LinkedIn API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        error: errorData
      });
      throw new Error(`LinkedIn API error: ${errorData.message || response.statusText}`);
    }

    const linkedinResponse = await response.json();
    console.log("Successfully posted to LinkedIn:", linkedinResponse);
    return linkedinResponse;

  } catch (error) {
    console.error("Failed to post to LinkedIn:", error);
    throw error;
  }
};

// Post job network jobs to LinkedIn
module.exports.postJobNetworkPostsToLinkedIn = async (jobNetwork) => {
  try {
    // Validate LinkedIn credentials first
    validateLinkedInCredentials();

    // Get job posts where jn matches the provided jobNetwork value and from different organizations
    const queryDistinct = `
      SELECT DISTINCT ON (organization_id)
        id, 
        job_id, 
        job_title,
        duty_station,
        job_level,
        apply_link,
        created,
        end_date,
        organization_id,
        jn
      FROM 
        public.job_vacancies
      WHERE 
        jn = $1
      ORDER BY organization_id, created DESC
      LIMIT 5
    `;

    const resultDistinct = await pool.query(queryDistinct, [jobNetwork]);
    let jobPosts = resultDistinct.rows;

    // If less than 5 records, fill in with jobs from any organization
    if (jobPosts.length < 5) {
      const remainingSlots = 5 - jobPosts.length;
      const queryFill = `
        SELECT 
          id, 
          job_id, 
          job_title,
          duty_station,
          job_level,
          apply_link,
          created,
          end_date,
          organization_id,
          jn
        FROM 
          public.job_vacancies
        WHERE 
          jn = $1
        ORDER BY created DESC
        LIMIT ${remainingSlots}
      `;

      const resultFill = await pool.query(queryFill, [jobNetwork]);
      jobPosts = jobPosts.concat(resultFill.rows);
    }

    if (!jobPosts.length) {
      console.log(`No job posts found for job network: ${jobNetwork}`);
      return;
    }

    // Format message with emojis and proper spacing
    let message = `🌐 Job Opportunities in ${jobNetwork} Network:\n\n`;
    jobPosts.forEach(job => {
      message += `📌 ${job.job_title}\n`;
      message += `📍 ${job.duty_station}\n`;
      message += `🔗 Apply: https://www.unjobzone.com/job/${job.id}\n\n`;
    });
    message += "#UnitedNations #jobs #unjobs #careers #hiring #jobsearch #unjobzone #UN";
    
    // Validate and format organization ID
    const organizationId = process.env.LINKEDIN_ORGANIZATION_ID?.toString().trim();
    if (!organizationId || isNaN(organizationId)) {
      throw new Error('Invalid LinkedIn Organization ID');
    }

    // Verify access token exists and isn't expired
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new Error('Missing or invalid LinkedIn access token');
    }

    // Create LinkedIn share with verified author URN
    const authorUrn = `urn:li:organization:${organizationId}`;

    const url = "https://api.linkedin.com/v2/ugcPosts";
    const payload = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: message
          },
          shareMediaCategory: "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LinkedIn API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        error: errorData
      });
      throw new Error(`LinkedIn API error: ${errorData.message || response.statusText}`);
    }

    const linkedinResponse = await response.json();
    console.log("Successfully posted to LinkedIn:", linkedinResponse);
    return linkedinResponse;

  } catch (error) {
    console.error(`Failed to post to LinkedIn for job network: ${jobNetwork}`, error);
    throw error;
  }
};

// Utility function to validate LinkedIn credentials
const validateLinkedInCredentials = () => {
  const requiredEnvVars = [
    'LINKEDIN_CLIENT_ID',
    'LINKEDIN_CLIENT_SECRET',
    'LINKEDIN_ACCESS_TOKEN',
    'LINKEDIN_ORGANIZATION_ID'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length) {
    throw new Error(`Missing required LinkedIn credentials: ${missing.join(', ')}`);
  }
};

// Export utility function
module.exports.validateLinkedInCredentials = validateLinkedInCredentials;