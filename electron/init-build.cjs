const fs = require('fs');
const path = require('path');
const https = require('https');

const rawUrl = 'https://raw.githubusercontent.com/Bl3551nq/Overdesk-Logos/main/OVERDESK-checklist.png';
const base64Fallback = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AYZDhEXNf6TdgAAApdJREFUWMPFl8tO20AUhp/xTSAOgQQCQgKqqBvYIKFugm66atV1V6pU3XbZ9SNEvAALpIorVpAQLggJiY7tOHZsY+eXgCEmThzHTmKqnTWe45mPzzPnzDkaYyxpSctf8W/S8vX1dfb7fS4uLuK6rrEsC8uyMEYjpVTSNE02m01ms9lkr9dLf39/K38YgN1uh+u6TCYTZrOZMUbjuq6xLAvDMKSUkiRJVquVZVmWWZaVdV23Go1GfQAOBgPq9Tq9Xg9jDNbaF/DhcJhWq9XIsiyzLEtSSgXQ6XQolUokSZIsFgtarZZ9CgAAbm5uKBaLbDaBL+DGGKSUYrvdotFo5OnpabG7u8vj42N4fHwk/ggAvu9zdXWFEAJsNuVv2W63yOfzdLtd/G/u7mMAhBCcn58jhAAsy8KwLDabDQA0Go10dnZGrVZDCEG9Xv8GgGEYfHx8IIQAwDAsDMNASgkhBKlUivX6899/EIAQAtd1P8EvFot4vj+vF7fb7dBoNMiyDCEExWLRawXv7+/EcRy63S5SSgBSSofBYEAmk8G2bezb21v3WwAopWiaRqPRQEqJlBLbdZm/SxzHIUmS0O/3XWMMY4zZasb5HAAWiwVCCNLpNJvNhpRSlmXFarVi2zaapsXvA8C2bRqNBmKMb6vWNE0sy0Lf3t66pmlimiYAZVke7nkeuVyOvL3N066Xy+VYLpek02mq1SoA9XqdSqWCEALf9/mXfBiAxWLBx8cH9uXlpRsEAVEU8fn5CcDisUAcxwRBQBCEUkrZ7XYZDAZYa6nVaggheHh7C4AoirBtm3wYgGazSblcptvtslgs3jY7m82m6/s+xhhzf39vq9Uqr6+vhGGI4zhYlhVCqfR9vby89FzXZT6fUywWX79P/4W/Af7z0gL8AfzQG7/gvw6IAAAAAElFTkSuQmCC';

const destPath = path.join(__dirname, 'icon.png');

console.log('Downloading custom logo from GitHub...');

function downloadWithFallback(url, dest) {
  const file = fs.createWriteStream(dest);
  
  const writeFallback = () => {
    file.close(() => {
      fs.writeFileSync(dest, base64Fallback, 'base64');
      console.log('Successfully written fallback logo icon.');
    });
  };

  const timer = setTimeout(() => {
    console.log('Download timed out, falling back to offline icon...');
    file.destroy();
    writeFallback();
  }, 10000);

  const request = https.get(url, (response) => {
    // Handle redirect
    if (response.statusCode === 301 || response.statusCode === 302) {
      clearTimeout(timer);
      file.destroy();
      downloadWithFallback(response.headers.location, dest);
      return;
    }

    if (response.statusCode !== 200) {
      console.log(`HTTP ${response.statusCode} error downloading logo, falling back to offline icon.`);
      clearTimeout(timer);
      file.destroy();
      writeFallback();
      return;
    }

    response.pipe(file);

    file.on('finish', () => {
      clearTimeout(timer);
      file.close(() => {
        try {
          const stats = fs.statSync(dest);
          if (stats.size > 100) {
            console.log(`Successfully downloaded custom GitHub logo - file size: ${Math.round(stats.size / 1024)} KB`);
          } else {
            console.log('Downloaded logo was empty, writing fallback icon.');
            fs.writeFileSync(dest, base64Fallback, 'base64');
          }
        } catch (e) {
          fs.writeFileSync(dest, base64Fallback, 'base64');
        }
      });
    });
  });

  request.on('error', (err) => {
    clearTimeout(timer);
    file.destroy();
    console.log(`Network error while downloading logo: ${err.message}. Writing fallback.`);
    writeFallback();
  });
}

downloadWithFallback(rawUrl, destPath);
