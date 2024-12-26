require("dotenv").config();
const { Client } = require('pg');
const { credentials } = require("./db");

async function generateJobRelatedBlogPost() {
    const apiKey = `${process.env.OPENAI_API_KEY}`; // Replace with your OpenAI API key
    const prompt = 'Generate a job-related blog post with a title and body for international organization like United Nations. Format the body in multiple paragraphs with html formatting tags including <p><br><strong><em>, etc... add html tag ONLY on the body not on the title';
  
    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'system', content: prompt }],
            max_tokens: 500,
            n: 1,
            stop: null,
            temperature: 0.7,
          }),
        }
      );
  
      const data = await response.json();
      let generatedText = data.choices[0].message.content.trim();
      let [title, ...body] = generatedText.split('\n').filter(line => line.trim() !== '');

      // Remove "Title: " prefix if it exists
      if (title.startsWith('Title: ')) {
        title = title.replace('Title: ', '');
      }
    // Remove double quotes from the title
    title = title.replace(/"/g, '');
      const blogPost = {
        title: title,
        content: body.join('\n'),
        featured: "No",
        thumbnail: "3.webp"
      };

      // Save the blog post to the database
      const client = new Client(credentials);
      await client.connect();
      const query = `
        INSERT INTO public.blog (title, content, featured, thumbnail)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
      const values = [blogPost.title, blogPost.content, blogPost.featured, blogPost.thumbnail];
      const res = await client.query(query, values);
      await client.end();

      return { id: res.rows[0].id, ...blogPost };
    } catch (error) {
      console.error('Error generating blog post:', error);
      throw new Error('Failed to generate blog post');
    }
}

module.exports = { generateJobRelatedBlogPost };