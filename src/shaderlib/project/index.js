import fs from 'fs';
import path from 'path';
export default {
  project: {
    interface: 'project',
    source: fs.readFileSync(path.join(__dirname, '/project.glsl'), 'utf8')
  }
};
