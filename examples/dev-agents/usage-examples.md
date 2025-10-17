# 🤖 Development Agents - Usage Examples

ตัวอย่างการใช้งาน Development Multi-Agent System

---

## 📋 Table of Contents

1. [Code Review Examples](#code-review-examples)
2. [Test Generation Examples](#test-generation-examples)
3. [Documentation Examples](#documentation-examples)
4. [Debug Examples](#debug-examples)
5. [Workflow Examples](#workflow-examples)

---

## 🔍 Code Review Examples

### Example 1: Basic Code Review

```bash
# Review ไฟล์เดียว
npm run dev-agent review src/agents/specialized/HealthAgent.ts
```

**Output:**
```
🔍 Reviewing: src/agents/specialized/HealthAgent.ts

📊 Score: 85/100

📝 Summary: Well-structured code with good type safety...

💚 Strengths:
   ✓ Strong type definitions
   ✓ Clear function names

⚠️  Issues (2):

1. 🟡 MEDIUM - Line 45
   Category: error-handling
   Issue: Missing try-catch block
   Fix: Wrap async operation in try-catch

💡 Suggestions:
   - Add input validation
   - Consider caching queries
```

### Example 2: Security-Focused Review

```bash
# ตรวจสอบความปลอดภัย
npm run review src/services/supabase.service.ts -- --security
```

**Use Case:** ก่อน deploy production หรือเมื่อจัดการกับข้อมูลผู้ใช้

### Example 3: Performance Review

```bash
# วิเคราะห์ performance
npm run review src/agents/core/OrchestratorAgent.ts -- --performance
```

**Output:**
```
⚠️  Issues (3):

1. 🟠 HIGH - Line 120
   Category: performance
   Issue: O(n²) complexity in nested loops
   Fix: Use Map for O(1) lookup instead

2. 🟡 MEDIUM - Line 200
   Category: performance
   Issue: Unnecessary array copying
   Fix: Use array destructuring or spread operator

3. 🟢 LOW - Line 300
   Category: performance
   Issue: Synchronous file I/O
   Fix: Use async fs.promises
```

### Example 4: Review All Files in Directory

```bash
# Review ทุกไฟล์ใน directory
npm run review:all "src/agents/**/*.ts" -- --output review-report.md
```

**Output:** สร้างรายงาน `review-report.md` พร้อม summary ทั้งหมด

---

## 🧪 Test Generation Examples

### Example 5: Generate Unit Tests

```bash
# สร้าง unit test
npm run test:gen src/agents/specialized/HealthAgent.ts
```

**Generated:** `src/agents/specialized/HealthAgent.test.ts`

```typescript
import { HealthAgent } from './HealthAgent';

describe('HealthAgent', () => {
  let agent: HealthAgent;

  beforeEach(() => {
    agent = new HealthAgent();
  });

  describe('process', () => {
    it('should log medication when user reports taking medicine', async () => {
      // Arrange
      const message = {
        content: 'กินยาแล้วค่ะ',
        context: { userId: 'U123', timestamp: new Date() }
      };

      // Act
      const result = await agent.process(message);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.taskType).toBe('medication');
    });
  });
});
```

### Example 6: Generate Integration Tests with Mocks

```bash
# สร้าง integration test พร้อม mocks
npm run test:gen src/services/supabase.service.ts -- --integration --mock
```

**Generated Test:**
```typescript
import { SupabaseService } from './supabase.service';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null })
    }))
  }))
}));

describe('SupabaseService Integration Tests', () => {
  // Tests...
});
```

### Example 7: Batch Test Generation

```bash
# สร้าง tests สำหรับทุกไฟล์ใน directory
npm run dev-agent test-all src/agents/specialized
```

**Output:**
```
🧪 Generating tests for directory: src/agents/specialized

Found 5 files to process.

✅ Generated: src/agents/specialized/HealthAgent.test.ts
✅ Generated: src/agents/specialized/AlertAgent.test.ts
✅ Generated: src/agents/specialized/ReportAgent.test.ts
✅ Generated: src/agents/specialized/IntentAgent.test.ts
✅ Generated: src/agents/specialized/DialogAgent.test.ts

📊 Summary:
- ✅ Successful: 5
- ❌ Failed: 0
```

---

## 📚 Documentation Examples

### Example 8: Add JSDoc Comments

```bash
# เพิ่ม JSDoc comments
npm run doc:gen src/agents/specialized/HealthAgent.ts -- --jsdoc
```

**Before:**
```typescript
export class HealthAgent extends BaseAgent {
  async process(message: Message): Promise<AgentResult> {
    // ...
  }
}
```

**After:**
```typescript
/**
 * Health Agent - Processes health-related data and logs to database
 *
 * This agent handles medication logging, vital signs recording,
 * water intake tracking, and activity logging.
 *
 * @example
 * const agent = new HealthAgent();
 * const result = await agent.process({
 *   content: 'วัดความดัน 120/80',
 *   context: { userId: 'U123' }
 * });
 */
export class HealthAgent extends BaseAgent {
  /**
   * Process health-related messages
   *
   * @param message - The message from user containing health data
   * @returns Processing result with logged data
   * @throws {ValidationError} When health data is invalid
   */
  async process(message: Message): Promise<AgentResult> {
    // ...
  }
}
```

### Example 9: Generate README

```bash
# สร้าง README.md สำหรับ project
npm run doc:gen . -- --readme
```

**Generated:** `README.md` พร้อม sections ครบถ้วน

### Example 10: Generate API Documentation

```bash
# สร้าง API docs
npm run doc:gen src/services/supabase.service.ts -- --api
```

**Generated:** `src/services/supabase.service.api.md`

### Example 11: Generate Architecture Diagrams

```bash
# สร้าง architecture diagrams ด้วย Mermaid
npm run doc:gen . -- --architecture
```

**Generated:** `docs/ARCHITECTURE.md` พร้อม Mermaid diagrams

---

## 🐛 Debug Examples

### Example 12: Analyze Runtime Error

```bash
# วิเคราะห์ error
npm run debug:agent src/agents/specialized/HealthAgent.ts -- \
  --error "TypeError: Cannot read property 'map' of undefined"
```

**Output:**
```markdown
# 🐛 Debug Report

## Root Cause
The `vitals` array is undefined when user doesn't have previous records.

## Fix

### Code
\`\`\`typescript
// Before
const systolicValues = vitals.map(v => v.systolic);

// After
const systolicValues = (vitals || []).map(v => v.systolic);
\`\`\`

## Prevention Tips
- Always check if array exists before using array methods
- Use optional chaining: `vitals?.map()`
- Set default values in function parameters
```

### Example 13: Analyze with Stack Trace

```bash
# วิเคราะห์พร้อม stack trace
npm run debug:agent src/services/supabase.service.ts -- \
  --error "Connection timeout" \
  --stack "at SupabaseService.query (supabase.service.ts:45)" \
  --output debug-report.md
```

### Example 14: Performance Analysis

```bash
# วิเคราะห์ performance issues
npm run debug:agent src/agents/core/OrchestratorAgent.ts -- --performance
```

**Output:**
```json
{
  "score": 75,
  "issues": [
    {
      "line": 120,
      "issue": "Nested loops causing O(n²) complexity",
      "impact": "high",
      "suggestion": "Use Map for O(1) lookup"
    }
  ],
  "optimizations": [
    "Cache agent results",
    "Use Promise.all() for parallel execution",
    "Implement connection pooling"
  ]
}
```

### Example 15: Analyze Log Files

```bash
# วิเคราะห์ log files
npm run debug:agent logs/app.log -- --logs
```

**Output:**
```markdown
# Log Analysis

## Summary
Found 45 errors and 120 warnings in 24 hours.

## Error Patterns
1. **Connection Timeout** (20 occurrences)
   - First: 2024-01-16 10:23:45
   - Last: 2024-01-16 15:30:12
   - Recommendation: Increase timeout or check network

2. **Invalid User ID** (15 occurrences)
   - Pattern: User ID format mismatch
   - Recommendation: Add input validation

3. **Database Lock** (10 occurrences)
   - Peak time: 14:00-15:00
   - Recommendation: Implement retry logic
```

---

## 🔄 Workflow Examples

### Workflow 1: Complete Feature Development

```bash
# Step 1: Review existing code
npm run review src/agents/specialized/HealthAgent.ts -- --strict

# Step 2: Make changes to code
# ... (edit code)

# Step 3: Generate tests
npm run test:gen src/agents/specialized/HealthAgent.ts -- --mock

# Step 4: Add documentation
npm run doc:gen src/agents/specialized/HealthAgent.ts -- --jsdoc

# Step 5: Review again
npm run review src/agents/specialized/HealthAgent.ts

# Step 6: Run tests
npm test
```

### Workflow 2: Bug Fixing

```bash
# Step 1: Analyze error
npm run debug:agent src/services/supabase.service.ts -- \
  --error "Connection failed" \
  --output debug-report.md

# Step 2: Review report
cat debug-report.md

# Step 3: Apply fixes
# ... (edit code based on suggestions)

# Step 4: Generate/update tests
npm run test:gen src/services/supabase.service.ts

# Step 5: Run tests
npm test

# Step 6: Final review
npm run review src/services/supabase.service.ts
```

### Workflow 3: Pre-Commit Check

```bash
# สร้าง script ใน .git/hooks/pre-commit

#!/bin/bash
echo "Running pre-commit checks..."

# Review changed files
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.ts$')

for file in $CHANGED_FILES; do
  echo "Reviewing: $file"
  npm run review "$file" -- --strict
done

# Run tests
npm test

echo "Pre-commit checks passed!"
```

### Workflow 4: Interactive Development

```bash
# เริ่ม interactive mode
npm run dev-agent:interactive

# จากนั้นใช้คำสั่ง:
dev-agent> @review src/agents/specialized/HealthAgent.ts
dev-agent> @test src/services/supabase.service.ts
dev-agent> @doc src/agents/core/BaseAgent.ts
dev-agent> @debug src/index.ts
dev-agent> exit
```

### Workflow 5: CI/CD Integration

```yaml
# .github/workflows/code-quality.yml
name: Code Quality Check

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run review:all "src/**/*.ts" -- --output review-report.md
      - uses: actions/upload-artifact@v3
        with:
          name: review-report
          path: review-report.md
```

---

## 🎯 Real-World Scenarios

### Scenario 1: New Developer Onboarding

```bash
# สร้าง documentation ทั้งหมด
npm run doc:gen . -- --readme
npm run doc:gen . -- --architecture
npm run doc:gen src/services/supabase.service.ts -- --api

# Review codebase เพื่อเข้าใจ
npm run review:all "src/**/*.ts" -- --output onboarding-review.md
```

### Scenario 2: Production Bug Investigation

```bash
# วิเคราะห์ production logs
npm run debug:agent logs/production.log -- --logs --output incident-report.md

# Debug specific file
npm run debug:agent src/agents/specialized/AlertAgent.ts -- \
  --error "Alert not sent" \
  --stack "$(cat stack-trace.txt)"

# Generate fix verification tests
npm run test:gen src/agents/specialized/AlertAgent.ts
```

### Scenario 3: Code Quality Improvement Sprint

```bash
# Day 1: Assessment
npm run review:all "src/**/*.ts" -- --strict --output assessment.md

# Day 2-4: Fix issues
# ... (work on fixes)

# Day 5: Verification
npm run review:all "src/**/*.ts" -- --output final-assessment.md

# Compare improvements
diff assessment.md final-assessment.md
```

---

## 💡 Tips & Best Practices

### Tip 1: Use Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
alias dareview='npm run review'
alias datest='npm run test:gen'
alias dadoc='npm run doc:gen'
alias dadebug='npm run debug:agent'
alias dai='npm run dev-agent:interactive'
```

### Tip 2: Create Project-Specific Scripts

```json
{
  "scripts": {
    "qa": "npm run review:all 'src/**/*.ts' && npm test",
    "pre-deploy": "npm run qa && npm run build",
    "doc:all": "npm run doc:gen . --readme && npm run doc:gen . --architecture"
  }
}
```

### Tip 3: Combine with Git Hooks

```bash
# .git/hooks/pre-push
npm run review:all "src/**/*.ts" -- --strict
npm test
```

---

## 📊 Expected Results

### Review Agent
- Average score: 80-90/100 for production code
- Processing time: 5-10 seconds per file
- Accuracy: ~90% issue detection

### Test Generator
- Coverage: 70-80% with generated tests
- Processing time: 10-15 seconds per file
- Quality: Requires 10-20% manual adjustment

### Documentation Agent
- JSDoc completeness: 90%+
- Processing time: 5-10 seconds per file
- Accuracy: 95% for standard patterns

### Debug Agent
- Root cause accuracy: 80-85%
- Processing time: 10-20 seconds
- Fix success rate: 70-80%

---

## 🔧 Troubleshooting

### Common Issues

**Issue:** Agent takes too long
```bash
# Use specific agent instead of review-all
npm run review src/specific/file.ts
```

**Issue:** Generated code needs adjustment
```bash
# That's normal! AI helps but doesn't replace review
# Always review and adjust generated code
```

**Issue:** API rate limits
```bash
# Space out requests or use batch mode
# Consider upgrading Claude API tier
```

---

**Last Updated:** 2024-01-16
**Version:** 1.0.0
