# Feature Specification Template

> Copy this template to create new feature specs in `docs/specs/`

---

## Feature Name
[Short descriptive name]

## Overview
[1-2 paragraphs describing what this feature does and why it's needed]

## User Story
**As a** [user type]
**I want** [goal]
**So that** [benefit]

## Requirements

### Functional Requirements
- [ ] FR-1: [Requirement description]
- [ ] FR-2: [Requirement description]
- [ ] FR-3: [Requirement description]

### Technical Requirements
- [ ] TR-1: [Technical constraint or requirement]
- [ ] TR-2: [Technical constraint or requirement]

### Non-Functional Requirements
- [ ] NFR-1: [Performance, security, etc.]
- [ ] NFR-2: [Performance, security, etc.]

## Implementation Details

### Files to Create
```
src/
  ├── agents/specialized/[NewAgent].ts
  ├── services/[NewService].ts
  └── types/[NewTypes].ts
```

### Files to Modify
- `src/agents/core/OrchestratorAgent.ts` - Add new agent
- `src/types/agent.types.ts` - Add types
- Other files as needed

### Dependencies
- [ ] New npm packages: [list packages]
- [ ] External APIs: [list APIs]
- [ ] Database changes: [describe schema changes]

## Data Model

### Database Schema
```sql
-- Add new tables or modify existing
CREATE TABLE example (
  id UUID PRIMARY KEY,
  ...
);
```

### TypeScript Types
```typescript
interface Example {
  id: string;
  // ...
}
```

## API Design

### Endpoints (if applicable)
```
POST /api/endpoint
GET /api/endpoint/:id
```

### Agent Methods
```typescript
class NewAgent {
  async processRequest(message: Message): Promise<Result>
  async validateData(data: Data): Promise<boolean>
}
```

## Testing Strategy

### Unit Tests
- Test agent processing logic
- Test validation functions
- Test error handling

### Integration Tests
- Test with real LINE messages
- Test with Supabase
- Test with Claude API

### Test Scenarios
1. **Happy Path**: [Describe normal flow]
2. **Edge Cases**: [List edge cases]
3. **Error Cases**: [List error scenarios]

## Acceptance Criteria

### Definition of Done
- [ ] Code implemented and reviewed
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Deployed to staging and tested
- [ ] Ready for production

### Success Metrics
- [ ] Feature works as expected
- [ ] Response time < [X]ms
- [ ] No errors in logs
- [ ] User acceptance testing passed

## Dependencies & Risks

### Dependencies
- [ ] Depends on Feature X being completed first
- [ ] Requires API key from Service Y
- [ ] Needs database migration

### Risks
- ⚠️ **Risk 1**: [Description] - Mitigation: [Solution]
- ⚠️ **Risk 2**: [Description] - Mitigation: [Solution]

## Timeline

### Estimated Effort
- Planning: [X hours]
- Implementation: [X hours]
- Testing: [X hours]
- Documentation: [X hours]
- **Total**: [X hours / X days]

### Milestones
- [ ] M1: Design approved
- [ ] M2: Core functionality implemented
- [ ] M3: Tests completed
- [ ] M4: Production ready

## Examples

### Input Example
```typescript
const input = {
  userId: "U1234",
  message: "วัดความดัน 120/80"
};
```

### Output Example
```typescript
const output = {
  success: true,
  data: {
    bloodPressure: {
      systolic: 120,
      diastolic: 80
    }
  }
};
```

## Notes
- Additional context or information
- Related features or tickets
- Links to design docs

---

**Created**: [YYYY-MM-DD]
**Author**: [Your Name]
**Status**: Draft | In Progress | Review | Completed
