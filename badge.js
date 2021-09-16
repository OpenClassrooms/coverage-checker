const fetch = require('node-fetch');
const fs = require('fs');

const processBadgeColor = (coverage) => {
    const colors = [
        { threshold: 50, color: 'red' },
        { threshold: 75, color: 'orange' },
        { threshold: 95, color: 'yellow' }
    ];

    for (let i = 0 ; i < colors.length ; i++) {
        if (coverage < colors[i].threshold) {
            return colors[i].color;
        }
    }

    return 'green';
}

const getBadgeUrl = (coverage, label) => `https://img.shields.io/static/v1?label=${encodeURIComponent(label)}&message=${encodeURIComponent(coverage)}%25&color=${processBadgeColor(coverage)}&style=for-the-badge`;

const generateBadge = async (coverageValue, label, badgeFilename, workingDir) => {
    const badgeContent = await fetch(getBadgeUrl(coverageValue, label));

    fs.writeFileSync(`${workingDir}/${badgeFilename}`, await badgeContent.text());
}

export { generateBadge };
