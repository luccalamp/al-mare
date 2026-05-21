const fs = require('fs');
const https = require('https');
const path = require('path');

async function run() {
  const projectJson = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
  const { projectId, orgId } = projectJson;
  
  const authPath = path.join(process.env.APPDATA, 'com.vercel.cli', 'Data', 'auth.json');
  const authJson = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const token = authJson.token;

  const options = {
    hostname: 'api.vercel.com',
    path: `/v9/projects/${projectId}?teamId=${orgId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const project = JSON.parse(data);
      console.log(`Project Name: ${project.name}`);
      console.log(`rootDirectory present: ${'rootDirectory' in project}`);
      console.log(`rootDirectory value: ${project.rootDirectory}`);
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });
  req.end();
}

run();
