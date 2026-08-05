const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
// ✅ Enable CORS
app.use(cors());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

// Helper function: scrape single post
function cleanVideoUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname;
    } catch (e) {
        return url.split("?")[0];
    }
}

async function scrapePost(url) {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // 👇 Customize selectors yaha change karna padega
        const title = $(".stitle").text().trim();
        
        let content = $('.description p').text().trim() || null;
        if (content && /UncutMaza(\.com\.co)?/i.test(content)) {
          content = content.replace(/UncutMaza(\.com\.co)?/gi, 'HixSeries.com');
        }
        const imageUrl = $('#my-video').attr('poster') || null;

         const series = $('.series-list a').text().trim();


       // Extract all categories
        const models = [];
        $('.model-list a').each((i, el) => {
          const model = $(el).text().trim();
          if (model) {
            models.push(model);
          }
        });
       

         const tags = [];
        $('.taxonomy .tag').each((i, el) => {
          const tagText = $(el).text().trim(); // Get the text content of each tag
          if (tagText) {
            tags.push(tagText); // Add the tag to the array
          }
        });

        // Extract all categories
        const categories = [];
        $('.taxonomy .cat').each((i, el) => {
          const category = $(el).text().trim();
          if (category) {
            categories.push(category);
          }
        });

let rawVideo =
    $("video#my-video").attr("src") ||
    $("video").attr("src") ||
    $('video#my-video source[type="video/mp4"]').attr("src") ||
    $('video source[type="video/mp4"]').attr("src") ||
    $("iframe").attr("src") ||  // fallback
    null;

if (!rawVideo) {
    return res.status(404).json({ error: "Video not found" });
}

const videoUrl = cleanVideoUrl(rawVideo);

        
         ////////START DURATION/////////
          let targetSchema = null;
          
          $('script[type="application/ld+json"]').each((i, el) => {
            try {
              const json = JSON.parse($(el).html());
          
              if (json['@type'] === 'VideoObject') {
                targetSchema = json;
              }
          
            } catch {}
          });

          // ---- Duration extract ----
          let totalMinutes = null;
          let isoDuration = null;
          
          if (targetSchema && targetSchema.duration) {
            isoDuration = targetSchema.duration;
          
            // PT23M00S / PT1H02M / PT49M
            const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          
            if (match) {
              const hours = parseInt(match[1] || 0, 10);
              const minutes = parseInt(match[2] || 0, 10);
              totalMinutes = hours * 60 + minutes;
            }
          }
          
          // console.log('ISO Duration:', isoDuration);
          // console.log('Duration in minutes:', totalMinutes);
             ////////END DURATION/////////

        return {
            url,
            title,
            tags,
            categories,
            videoUrl,
            models,
            series,
            imageUrl,
            content,
            totalMinutes

        };

    } catch (err) {
        return { url, error: "Failed to scrape" };
    }
}

// Main route
app.get("/series", async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: "URL required" });
    }

    try {
        const { data } = await axios.get(targetUrl);
        const $ = cheerio.load(data);

        const links = [];

        // 👇 yahi tumhara main selector hai
        $(".videos a").each((i, el) => {
            let link = $(el).attr("href");
            if (link && !link.startsWith("http")) {
                link = new URL(link, targetUrl).href;
            }
            links.push(link);
        });

        // Remove duplicates
        const uniqueLinks = [...new Set(links)];

        // Scrape all posts
        const results = await Promise.all(
            uniqueLinks.map(link => scrapePost(link))
        );

        res.json({
            total: results.length,
            data: results
        });

    } catch (err) {
        res.status(500).json({ error: "Scraping failed" });
    }
});

app.get("/test", (req, res) => {
    res.send("Test route working");
});
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running...");
});
