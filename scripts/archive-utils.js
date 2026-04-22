import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH    = join(__dirname, '../data/wars.json');
const ARCHIVE_PATH = join(__dirname, '../data/wars-archive.json');

function readWars(path) {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8')).wars || [];
}

export function loadActiveWars() {
  return readWars(DATA_PATH);
}

export function loadArchivedWars() {
  return readWars(ARCHIVE_PATH);
}

export function loadAllWars() {
  return [...loadActiveWars(), ...loadArchivedWars()];
}

export function findWarByEndTime(endTime) {
  return loadAllWars().find(w => w.endTime === endTime) || null;
}
