import { openDatabase } from './database';
const { sqlite } = openDatabase();
sqlite.close();
console.log('Database migrations applied.');
