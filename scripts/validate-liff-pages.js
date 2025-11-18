#!/usr/bin/env node
/**
 * Validation Script for LIFF Pages
 * Run before: git push or npm run deploy
 */

const fs = require('fs');
const path = require('path');

const LIFF_DIR = 'public/liff';
const errors = [];
const warnings = [];

console.log('🔍 Validating LIFF pages...\n');

// Get all HTML files
const files = fs.readdirSync(LIFF_DIR).filter(f => f.endsWith('.html'));

files.forEach(fileName => {
  const filePath = path.join(LIFF_DIR, fileName);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  console.log(`📄 Checking ${fileName}...`);

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Check 1: Dangerous relative script paths (NOT starting with http)
    const scriptMatch = line.match(/<script[^>]+src=["']([^"']+\.js)["']/);
    if (scriptMatch) {
      const src = scriptMatch[1];
      if (!src.startsWith('http')) {
        errors.push({
          file: fileName,
          line: lineNum,
          type: 'DANGEROUS_SCRIPT_PATH',
          message: `Relative script path: "${src}"`,
          suggestion: 'Remove or use inline script'
        });
      }
    }

    // Check 2: Old Supabase URL
    if (line.includes('xibtslxxjxossybxisdr.supabase.co')) {
      errors.push({
        file: fileName,
        line: lineNum,
        type: 'OLD_SUPABASE_URL',
        message: 'Using old Supabase project',
        suggestion: 'Update to: mqxklnzxfrupwwkwlwwc.supabase.co'
      });
    }
  });
});

// Print results
console.log('\n' + '='.repeat(60));

if (errors.length > 0) {
  console.log('\n❌ ERRORS FOUND:\n');
  errors.forEach(err => {
    console.log(`  ${err.file}:${err.line}`);
    console.log(`  ❌ ${err.type}`);
    console.log(`  📝 ${err.message}`);
    console.log(`  💡 ${err.suggestion}\n`);
  });
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS:\n');
  warnings.forEach(warn => {
    console.log(`  ${warn.file}:${warn.line}`);
    console.log(`  ⚠️  ${warn.type}: ${warn.message}\n`);
  });
}

console.log('='.repeat(60));

if (errors.length === 0) {
  console.log('\n✅ All LIFF pages validated successfully!\n');
  process.exit(0);
} else {
  console.log(`\n❌ Found ${errors.length} errors!`);
  console.log('Fix these issues before deploying.\n');
  process.exit(1);
}
