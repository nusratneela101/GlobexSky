/**
 * Globex Sky — Language Routes
 * Provides admin and public endpoints for language/i18n management.
 *
 * Admin routes (require authenticate + requireAdmin middleware):
 *   GET    /api/v1/admin/languages          — list all configured languages
 *   POST   /api/v1/admin/languages          — add a new language
 *   PUT    /api/v1/admin/languages/:code    — update language (enable/disable/rename)
 *   DELETE /api/v1/admin/languages/:code    — remove a language
 *
 * Public routes:
 *   GET    /api/v1/languages/:code/strings  — get all translation strings for a language
 *   PUT    /api/v1/languages/:code/strings  — bulk update translation strings (admin)
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validate } from '../middleware/validator.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';

const router = Router();

/* ─── Resolve path to the /locales directory ─── */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../../locales');

/** All supported language metadata */
const LANGUAGE_REGISTRY = [
  { code: 'en', name: 'English',          native: 'English',           flag: '🇬🇧', dir: 'ltr', active: true,  isDefault: true  },
  { code: 'bn', name: 'Bengali',          native: 'বাংলা',             flag: '🇧🇩', dir: 'ltr', active: true,  isDefault: false },
  { code: 'ar', name: 'Arabic',           native: 'العربية',           flag: '🇸🇦', dir: 'rtl', active: true,  isDefault: false },
  { code: 'hi', name: 'Hindi',            native: 'हिन्दी',            flag: '🇮🇳', dir: 'ltr', active: true,  isDefault: false },
  { code: 'zh', name: 'Chinese',          native: '中文',              flag: '🇨🇳', dir: 'ltr', active: true,  isDefault: false },
  { code: 'fr', name: 'French',           native: 'Français',          flag: '🇫🇷', dir: 'ltr', active: true,  isDefault: false },
  { code: 'es', name: 'Spanish',          native: 'Español',           flag: '🇪🇸', dir: 'ltr', active: true,  isDefault: false },
  { code: 'pt', name: 'Portuguese',       native: 'Português',         flag: '🇧🇷', dir: 'ltr', active: true,  isDefault: false },
  { code: 'ru', name: 'Russian',          native: 'Русский',           flag: '🇷🇺', dir: 'ltr', active: true,  isDefault: false },
  { code: 'de', name: 'German',           native: 'Deutsch',           flag: '🇩🇪', dir: 'ltr', active: true,  isDefault: false },
  { code: 'ja', name: 'Japanese',         native: '日本語',            flag: '🇯🇵', dir: 'ltr', active: true,  isDefault: false },
  { code: 'ko', name: 'Korean',           native: '한국어',            flag: '🇰🇷', dir: 'ltr', active: true,  isDefault: false },
  { code: 'tr', name: 'Turkish',          native: 'Türkçe',            flag: '🇹🇷', dir: 'ltr', active: true,  isDefault: false },
  { code: 'id', name: 'Indonesian',       native: 'Bahasa Indonesia',  flag: '🇮🇩', dir: 'ltr', active: true,  isDefault: false },
  { code: 'ms', name: 'Malay',            native: 'Bahasa Melayu',     flag: '🇲🇾', dir: 'ltr', active: true,  isDefault: false },
  { code: 'th', name: 'Thai',             native: 'ภาษาไทย',          flag: '🇹🇭', dir: 'ltr', active: true,  isDefault: false },
  { code: 'vi', name: 'Vietnamese',       native: 'Tiếng Việt',        flag: '🇻🇳', dir: 'ltr', active: true,  isDefault: false },
  { code: 'ur', name: 'Urdu',             native: 'اردو',              flag: '🇵🇰', dir: 'rtl', active: true,  isDefault: false },
  { code: 'fa', name: 'Persian',          native: 'فارسی',             flag: '🇮🇷', dir: 'rtl', active: true,  isDefault: false },
  { code: 'sw', name: 'Swahili',          native: 'Kiswahili',         flag: '🇰🇪', dir: 'ltr', active: true,  isDefault: false },
];

/* In-memory registry (replace with DB persistence in production) */
let languages = [...LANGUAGE_REGISTRY];

/* ─── Helpers ─── */

function readLocaleFile(code) {
  const filePath = path.join(LOCALES_DIR, `${code}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeLocaleFile(code, data) {
  const filePath = path.join(LOCALES_DIR, `${code}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/* ─────────────────────────────────────────────
   PUBLIC ROUTES
   Mounted at: /api/v1/languages
───────────────────────────────────────────── */

/**
 * GET /api/v1/languages/:code/strings
 * Return all translation strings for the given language code.
 */
router.get(
  '/:code/strings',
  [param('code').trim().isLength({ min: 2, max: 5 }).isAlpha()],
  validate,
  (req, res) => {
    const code = req.params.code.toLowerCase();
    const data = readLocaleFile(code);
    if (!data) {
      return res.status(404).json({ success: false, message: `Locale '${code}' not found.` });
    }
    return res.json({ success: true, code, data });
  },
);

/**
 * PUT /api/v1/languages/:code/strings
 * Bulk update translation strings for a language (admin only).
 */
router.put(
  '/:code/strings',
  authenticate,
  requireAdmin,
  [
    param('code').trim().isLength({ min: 2, max: 5 }).isAlpha(),
    body('strings').isObject().withMessage('strings must be a JSON object'),
  ],
  validate,
  (req, res) => {
    const code = req.params.code.toLowerCase();

    if (!languages.find((l) => l.code === code)) {
      return res.status(404).json({ success: false, message: `Language '${code}' not found.` });
    }

    const existing = readLocaleFile(code) || {};
    const merged   = Object.assign({}, existing, req.body.strings);

    try {
      writeLocaleFile(code, merged);
      return res.json({ success: true, message: `Strings updated for '${code}'.`, data: merged });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to write locale file.' });
    }
  },
);

/* ─────────────────────────────────────────────
   ADMIN ROUTES
   Mounted at: /api/v1/admin/languages
   These routes are exported separately for use with the admin prefix.
───────────────────────────────────────────── */

export const adminLanguageRouter = Router();

/**
 * GET /api/v1/admin/languages
 * List all configured languages with metadata.
 */
adminLanguageRouter.get('/', authenticate, requireAdmin, (req, res) => {
  return res.json({ success: true, languages });
});

/**
 * POST /api/v1/admin/languages
 * Add a new language entry.
 */
adminLanguageRouter.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('code').trim().isLength({ min: 2, max: 5 }).withMessage('code must be 2-5 characters'),
    body('name').trim().notEmpty().withMessage('name is required'),
    body('native').trim().notEmpty().withMessage('native name is required'),
    body('dir').optional().isIn(['ltr', 'rtl']).withMessage('dir must be ltr or rtl'),
    body('flag').optional().isString(),
  ],
  validate,
  (req, res) => {
    const { code, name, native, dir = 'ltr', flag = '🏳' } = req.body;
    const normalizedCode = code.toLowerCase();

    if (languages.find((l) => l.code === normalizedCode)) {
      return res.status(409).json({ success: false, message: `Language '${normalizedCode}' already exists.` });
    }

    const entry = { code: normalizedCode, name, native, flag, dir, active: true, isDefault: false };
    languages.push(entry);

    return res.status(201).json({ success: true, language: entry });
  },
);

/**
 * PUT /api/v1/admin/languages/:code
 * Update an existing language (enable/disable, rename, change direction).
 */
adminLanguageRouter.put(
  '/:code',
  authenticate,
  requireAdmin,
  [
    param('code').trim().isLength({ min: 2, max: 5 }),
    body('name').optional().trim().notEmpty(),
    body('native').optional().trim().notEmpty(),
    body('dir').optional().isIn(['ltr', 'rtl']),
    body('flag').optional().isString(),
    body('active').optional().isBoolean(),
    body('isDefault').optional().isBoolean(),
  ],
  validate,
  (req, res) => {
    const code = req.params.code.toLowerCase();
    const lang = languages.find((l) => l.code === code);

    if (!lang) {
      return res.status(404).json({ success: false, message: `Language '${code}' not found.` });
    }

    const { name, native, dir, flag, active, isDefault } = req.body;

    if (name    !== undefined) lang.name    = name;
    if (native  !== undefined) lang.native  = native;
    if (dir     !== undefined) lang.dir     = dir;
    if (flag    !== undefined) lang.flag    = flag;
    if (active  !== undefined) lang.active  = active;

    /* Setting a new default clears all others */
    if (isDefault === true) {
      languages.forEach((l) => { l.isDefault = false; });
      lang.isDefault = true;
    }

    return res.json({ success: true, language: lang });
  },
);

/**
 * DELETE /api/v1/admin/languages/:code
 * Remove a language (default language cannot be removed).
 */
adminLanguageRouter.delete(
  '/:code',
  authenticate,
  requireAdmin,
  [param('code').trim().isLength({ min: 2, max: 5 })],
  validate,
  (req, res) => {
    const code = req.params.code.toLowerCase();
    const idx  = languages.findIndex((l) => l.code === code);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: `Language '${code}' not found.` });
    }

    if (languages[idx].isDefault) {
      return res.status(400).json({ success: false, message: 'Cannot delete the default language.' });
    }

    languages.splice(idx, 1);
    return res.json({ success: true, message: `Language '${code}' removed.` });
  },
);

export default router;
