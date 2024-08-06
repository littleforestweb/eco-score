const fs = require('fs');
const path = require('path');
const { hosting, co2 } = require("@tgwf/co2");
const puppeteer = require('puppeteer');
const axios = require('axios');
const dns = require('dns').promises;
const { URL } = require('url');

/*
    Summary of the Little Forest Eco-Score Calculation Solution

    Lighthouse Integration:
        - Utilizes Lighthouse to analyze website performance and SEO. 
    
    Puppeteer Integration:
        - Puppeteer is used to automate the process of running Lighthouse in a headless browser.

    Metrics Calculated:
        - Performance Score: Measures how well the website performs based on Lighthouse's performance metrics.
        - SEO Score: Evaluates the website’s SEO effectiveness as per Lighthouse's SEO audit.
        - Page Load Time: Tracks the time taken for the website to load fully, specifically the "First Contentful Paint" time.
            -- Under 3.4 is the desirable value. (Ref.: https://developer.chrome.com/docs/lighthouse/performance/speed-index?hl=pt-br)
        - Transfer Size: The total size of data transferred by the website, measured in megabytes.
    
    Green Hosting Check:
        - Determines whether the website is hosted on a green or eco-friendly server using the @tgwf/co2 library.

    CO2 Emissions Calculation:
        - Uses the @tgwf/co2 library to estimate CO2 emissions based on the size of the page and whether the hosting is green.
        - The calculation is influenced by the country-specific grid intensity.
        - Thresholds and metrics based on https://sustainablewebdesign.org/estimating-digital-emissions/

    Server Location:
        - Identifies the physical location of the server hosting the website using a geo-location API.

    Score Calculation:
        - Performance Weight: 20% of the total score.
        - SEO Weight: 20% of the total score.
        - CO2 Emissions Weight: 35% of the total score, calculated relative to a CO2 goal.
        - Page Load Time Weight: 25% of the total score, based on how quickly the site loads.

    Combine Scores:
        Aggregate individual scores, applying their respective weights to compute the final score.

*/

// Define constants for thresholds and weights
const CO2_GOAL = 0.6;                       // grams per page view
const PAGE_LOAD_TIME_GOAL_SECONDS = 3.4;    // seconds
const SEO_GOAL = 85                         // lighthouse score
const PERFORMANCE_SCORE_GOAL = 85           // lighthouse score

const PERFORMANCE_WEIGHT = 0.20;
const SEO_WEIGHT = 0.20;
const CO2_WEIGHT = 0.40;
const PAGE_LOAD_TIME_WEIGHT = 0.20;

const countryNameToCode = {
    "Afghanistan": "AFG",
    "Albania": "ALB",
    "Algeria": "DZA",
    "Andorra": "AND",
    "Angola": "AGO",
    "Antigua and Barbuda": "ATG",
    "Argentina": "ARG",
    "Armenia": "ARM",
    "Australia": "AUS",
    "Austria": "AUT",
    "Azerbaijan": "AZE",
    "Bahamas": "BHS",
    "Bahrain": "BHR",
    "Bangladesh": "BGD",
    "Barbados": "BRB",
    "Belarus": "BLR",
    "Belgium": "BEL",
    "Belize": "BLZ",
    "Benin": "BEN",
    "Bhutan": "BTN",
    "Bolivia": "BOL",
    "Bosnia and Herzegovina": "BIH",
    "Botswana": "BWA",
    "Brazil": "BRA",
    "Brunei": "BRN",
    "Bulgaria": "BGR",
    "Burkina Faso": "BFA",
    "Burundi": "BDI",
    "Cabo Verde": "CPV",
    "Cambodia": "KHM",
    "Cameroon": "CMR",
    "Canada": "CAN",
    "Central African Republic": "CAF",
    "Chad": "TCD",
    "Chile": "CHL",
    "China": "CHN",
    "Colombia": "COL",
    "Comoros": "COM",
    "Congo, Democratic Republic of the": "COD",
    "Congo, Republic of the": "COG",
    "Costa Rica": "CRI",
    "Croatia": "HRV",
    "Cuba": "CUB",
    "Cyprus": "CYP",
    "Czech Republic": "CZE",
    "Denmark": "DNK",
    "Djibouti": "DJI",
    "Dominica": "DMA",
    "Dominican Republic": "DOM",
    "Ecuador": "ECU",
    "Egypt": "EGY",
    "El Salvador": "SLV",
    "Equatorial Guinea": "GNQ",
    "Eritrea": "ERI",
    "Estonia": "EST",
    "Eswatini": "SWZ",
    "Ethiopia": "ETH",
    "Fiji": "FJI",
    "Finland": "FIN",
    "France": "FRA",
    "Gabon": "GAB",
    "Gambia": "GMB",
    "Georgia": "GEO",
    "Germany": "DEU",
    "Ghana": "GHA",
    "Greece": "GRC",
    "Grenada": "GRD",
    "Guatemala": "GTM",
    "Guinea": "GIN",
    "Guinea-Bissau": "GNB",
    "Guyana": "GUY",
    "Haiti": "HTI",
    "Honduras": "HND",
    "Hungary": "HUN",
    "Iceland": "ISL",
    "India": "IND",
    "Indonesia": "IDN",
    "Iran": "IRN",
    "Iraq": "IRQ",
    "Ireland": "IRL",
    "Israel": "ISR",
    "Italy": "ITA",
    "Jamaica": "JAM",
    "Japan": "JPN",
    "Jordan": "JOR",
    "Kazakhstan": "KAZ",
    "Kenya": "KEN",
    "Kiribati": "KIR",
    "Korea, North": "PRK",
    "Korea, South": "KOR",
    "Kuwait": "KWT",
    "Kyrgyzstan": "KGZ",
    "Laos": "LAO",
    "Latvia": "LVA",
    "Lebanon": "LBN",
    "Lesotho": "LSO",
    "Liberia": "LBR",
    "Libya": "LBY",
    "Liechtenstein": "LIE",
    "Lithuania": "LTU",
    "Luxembourg": "LUX",
    "Madagascar": "MDG",
    "Malawi": "MWI",
    "Malaysia": "MYS",
    "Maldives": "MDV",
    "Mali": "MLI",
    "Malta": "MLT",
    "Marshall Islands": "MHL",
    "Mauritania": "MRT",
    "Mauritius": "MUS",
    "Mexico": "MEX",
    "Micronesia": "FSM",
    "Moldova": "MDA",
    "Monaco": "MCO",
    "Mongolia": "MNG",
    "Montenegro": "MNE",
    "Morocco": "MAR",
    "Mozambique": "MOZ",
    "Myanmar (Burma)": "MMR",
    "Namibia": "NAM",
    "Nauru": "NRU",
    "Nepal": "NPL",
    "Netherlands": "NLD",
    "New Zealand": "NZL",
    "Nicaragua": "NIC",
    "Niger": "NER",
    "Nigeria": "NGA",
    "North Macedonia": "MKD",
    "Norway": "NOR",
    "Oman": "OMN",
    "Pakistan": "PAK",
    "Palau": "PLW",
    "Palestine": "PSE",
    "Panama": "PAN",
    "Papua New Guinea": "PNG",
    "Paraguay": "PRY",
    "Peru": "PER",
    "Philippines": "PHL",
    "Poland": "POL",
    "Portugal": "PRT",
    "Qatar": "QAT",
    "Romania": "ROU",
    "Russia": "RUS",
    "Rwanda": "RWA",
    "Saint Kitts and Nevis": "KNA",
    "Saint Lucia": "LCA",
    "Saint Vincent and the Grenadines": "VCT",
    "Samoa": "WSM",
    "San Marino": "SMR",
    "Sao Tome and Principe": "STP",
    "Saudi Arabia": "SAU",
    "Senegal": "SEN",
    "Serbia": "SRB",
    "Seychelles": "SYC",
    "Sierra Leone": "SLE",
    "Singapore": "SGP",
    "Slovakia": "SVK",
    "Slovenia": "SVN",
    "Solomon Islands": "SLB",
    "Somalia": "SOM",
    "South Africa": "ZAF",
    "South Sudan": "SSD",
    "Spain": "ESP",
    "Sri Lanka": "LKA",
    "Sudan": "SDN",
    "Suriname": "SUR",
    "Sweden": "SWE",
    "Switzerland": "CHE",
    "Syria": "SYR",
    "Taiwan": "TWN",
    "Tajikistan": "TJK",
    "Tanzania": "TZA",
    "Thailand": "THA",
    "Timor-Leste": "TLS",
    "Togo": "TGO",
    "Tonga": "TON",
    "Trinidad and Tobago": "TTO",
    "Tunisia": "TUN",
    "Turkey": "TUR",
    "Turkmenistan": "TKM",
    "Tuvalu": "TUV",
    "Uganda": "UGA",
    "Ukraine": "UKR",
    "United Arab Emirates": "ARE",
    "United Kingdom": "GBR",
    "United States": "USA",
    "Uruguay": "URY",
    "Uzbekistan": "UZB",
    "Vanuatu": "VUT",
    "Vatican City": "VAT",
    "Venezuela": "VEN",
    "Vietnam": "VNM",
    "Yemen": "YEM",
    "Zambia": "ZMB",
    "Zimbabwe": "ZWE"
};

async function runLighthouse(url) {
    const lighthouse = await import('lighthouse');
    const browser = await puppeteer.launch({ headless: true });
    const { lhr } = await lighthouse.default(url, {
        port: new URL(browser.wsEndpoint()).port,
        output: 'json',
        logLevel: 'info'
    });
    await browser.close();
    return lhr;
}

async function getLighthouseScores(lhr) {
    // Get page weight breakdown based on asset types
    const networkRequests = lhr.audits['network-requests'].details.items;
    const resourceBreakdown = networkRequests.reduce((acc, request) => {
        const resourceType = request.resourceType;
        if (!acc[resourceType]) {
            acc[resourceType] = 0;
        }
        acc[resourceType] += request.transferSize / 1024; // in KB
        return acc;
    }, {});

    return {
        performance: lhr.categories.performance.score * 100,
        seo: lhr.categories.seo.score * 100,
        pageLoadTime: lhr.audits['first-contentful-paint'].numericValue / 1000, // in seconds
        transferSize: lhr.audits['total-byte-weight'].numericValue / 1024, // in KB
        transferSizeBreakdown: resourceBreakdown
    };
}

async function checkGreenHosting(domain) {
    const options = {
        verbose: true,
        userAgentIdentifier: "littleforestwebsitecarbon",
    };

    try {
        const result = await hosting.check(domain, options);
        return result.green;
    } catch (error) {
        console.error(`Error checking green hosting for ${domain}:`, error);
        return false;
    }
}

async function calculateCO2(pageWeight, countryCode, isGreenHost) {
    const co2Emission = new co2();

    const optionsCalc = {
        gridIntensity: {
            dataCenter: { country: countryCode }
        },
    };

    const estimatedCO2 = co2Emission.perByteTrace(pageWeight, isGreenHost);
    return estimatedCO2;
}

async function getServerLocation(domain) {
    try {
        const addresses = await dns.resolve4(domain);
        const ipAddress = addresses[0];
        const response = await axios.get(`https://freegeoip.app/json/${ipAddress}`);
        const locationData = response.data;

        return {
            country: locationData.country_name,
            region: locationData.region_name,
            city: locationData.city,
        };
    } catch (error) {
        console.error(`Error fetching server location for ${domain}:`, error);
        return null;
    }
}

function formatUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'http://' + url;
    }
    return url;
}

async function getEcoScore(url) {
    const lhr = await runLighthouse(url);
    const scores = await getLighthouseScores(lhr);
    const pageWeight = scores.transferSize; // in KB
    const serverLocation = await getServerLocation(new URL(url).hostname);
    const isGreenHost = await checkGreenHosting(new URL(url).hostname);

    if (!serverLocation) {
        throw new Error('Could not determine server location');
    }

    const pageWeightBreakdown = {};
    for (const [resourceType, size] of Object.entries(scores.transferSizeBreakdown)) {
        pageWeightBreakdown[resourceType] = size;
    }

    const countryCode = countryNameToCode[serverLocation.country];
    const co2Emissions = await calculateCO2(pageWeight * 1000, countryCode, isGreenHost);
    
    let co2Score;
    if (co2Emissions.co2 === 0) {
        co2Score = CO2_WEIGHT * 100;
    } else {
        co2Score = Math.min(Math.round((CO2_GOAL / co2Emissions.co2) * 100 * CO2_WEIGHT), CO2_WEIGHT * 100);
    }

    const performanceScore = Math.round(scores.performance * PERFORMANCE_WEIGHT);

    const seoScore = Math.round(Math.min(scores.seo / SEO_GOAL, 100) * SEO_WEIGHT);

    const pageLoadTime = isNaN(scores.pageLoadTime) ? 0 : scores.pageLoadTime;
    const pageLoadTimeScore = pageLoadTime <= PAGE_LOAD_TIME_GOAL_SECONDS
        ? 100
        : Math.round((PAGE_LOAD_TIME_GOAL_SECONDS / pageLoadTime) * 100);

    const weightedPageLoadTimeScore = Math.round(pageLoadTimeScore * PAGE_LOAD_TIME_WEIGHT);

    const ecoScore = (
        performanceScore +
        seoScore +
        weightedPageLoadTimeScore +
        co2Score
    );

    return {
        "Eco Score": Math.min(ecoScore, 100), // Ensure the score is capped at 100
        "Page Weight": scores.transferSize,
        "Weight Breakdown": pageWeightBreakdown,
        "Emissions per page": co2Emissions.co2,
        "Server Location": serverLocation.country,
        "Green Hosting": isGreenHost
    };
}

async function processSubdomains(filePath, outputFilePath) {
    writeStream = fs.createWriteStream(outputFilePath, { flags: 'a' });

    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const subdomains = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        for (let subdomain of subdomains) {
            subdomain = formatUrl(subdomain);
            try {
                writeStream.write(`Calculate for ${subdomain}:\n`);
                const ecoScore = await getEcoScore(subdomain);
                writeStream.write(`Little Forest Eco Score >> ${JSON.stringify(ecoScore, null, 2)} <<\n`);

                writeStream.write('----------------------------------\n');
            } catch (error) {
                writeStream.write(`Error calculating Eco Score for ${subdomain}: ${error}\n`);
            }
        }
    } catch (error) {
        console.error('Error reading subdomains file:', error);
    } finally {
        writeStream.end();
    }
}

// Parse command-line arguments
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--urls' && argv[i + 1]) {
            args.urls = argv[i + 1];
            i++;
        } else if (argv[i] === '--scoresfile' && argv[i + 1]) {
            args.scoresfile = argv[i + 1];
            i++;
        }
    }
    return args;
}

// Get command-line arguments
let writeStream;
const args = parseArgs(process.argv.slice(2));
const subdomainsFilePath = args.urls;
const outputFilePath = args.scoresfile;

// Validate arguments
if (!subdomainsFilePath || !outputFilePath) {
    console.error('Usage: node lf_ecoscore.js --urls <subdomains_file> --scoresfile <output_file>');
    process.exit(1);
}

// Resolve paths and process subdomains
const resolvedSubdomainsPath = path.resolve(subdomainsFilePath);
const resolvedOutputPath = path.resolve(outputFilePath);
processSubdomains(resolvedSubdomainsPath, resolvedOutputPath);