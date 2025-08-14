# Simurgh MVP - Technical Specification

## Project Overview
**Name**: Simurgh - The Wise Phoenix RFQ Handler  
**Purpose**: All-in-one RFQ handler to reduce 45-minute manual form filling to under 5 minutes  
**Target Users**: Small procurement team (2 users initially)  
**Theme**: Persian mythology-inspired design with blue/amber color scheme

## Core Value Proposition
Transform the tedious RFQ response process from 45 minutes of manual data entry to under 5 minutes through intelligent automation, while maintaining accuracy and compliance.

## System Architecture

### Tech Stack
- **Framework**: Next.js 14 with TypeScript and App Router
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Storage**: AWS S3 for PDF documents
- **AI**: OpenAI API for text extraction and field identification
- **PDF Processing**: pdf-lib (generation), pdf-parse (reading)
- **UI**: Tailwind CSS with Radix UI components
- **Validation**: Zod schemas
- **Deployment**: Vercel

### Database Schema
```sql
-- Company profile for all boilerplate information
company_profiles:
  - id, companyName, cageCode, dunsNumber
  - Full address fields
  - POC information
  - Certifications (smallBusiness, womanOwned, etc.)
  - Business details (NAICS, Tax ID)
  - Payment/shipping terms
  - Capabilities text

-- RFQ documents storage
rfq_documents:
  - id, fileName, s3Key, s3Url
  - extractedText, extractedFields (JSON)
  - rfqNumber, dueDate, contractingOffice
  - status, processingError
  - timestamps

-- Response tracking
rfq_responses:
  - id, rfqDocumentId, companyProfileId
  - responseData (JSON)
  - generatedPdfS3Key, generatedPdfUrl
  - status (draft/completed/submitted)
  - timestamps

-- Audit trail
rfq_history:
  - id, rfqDocumentId, rfqResponseId
  - action, details, performedBy
  - createdAt
```

## Feature Specifications

### 1. Company Profile Management
**Purpose**: One-time setup of all boilerplate company information

**UI Flow**:
1. Settings page with organized form sections
2. Auto-save on field blur
3. Visual confirmation of saves
4. Validation feedback

**Key Fields**:
- Company identifiers (name, CAGE, DUNS)
- Complete address
- Point of contact details
- Business certifications
- Default terms
- Capabilities statement

### 2. RFQ Upload & Processing
**Purpose**: Extract and understand RFQ requirements from PDFs

**Process Flow**:
1. Drag-and-drop PDF upload
2. Upload to S3 with presigned URL
3. Extract text using pdf-parse
4. Send to OpenAI for field identification
5. Store extracted data in database
6. Display identified fields to user

**AI Extraction Targets**:
- RFQ number and title
- Due date and time
- Required certifications
- Delivery requirements
- Payment terms
- Special clauses
- Form field mappings

### 3. Auto-Fill System
**Purpose**: Populate RFQ forms with company profile data

**Functionality**:
- Map profile fields to RFQ requirements
- Handle field variations (CAGE vs Cage Code)
- Preserve user edits
- Show fill status indicators
- Support partial fills

**Field Mapping Logic**:
```javascript
{
  "cage_code": ["CAGE", "Cage Code", "CAGE CODE"],
  "company_name": ["Company", "Vendor Name", "Business Name"],
  "duns": ["DUNS", "D-U-N-S", "DUNS Number"],
  // ... comprehensive mapping dictionary
}
```

### 4. Response Generation
**Purpose**: Create completed RFQ response PDFs

**Features**:
- Fill PDF form fields programmatically
- Generate cover letters if needed
- Attach capability statements
- Create submission-ready package
- Store in S3 with download link

### 5. History & Tracking
**Purpose**: Maintain audit trail and enable reuse

**Capabilities**:
- View all processed RFQs
- Access previous responses
- Clone previous submissions
- Track submission status
- Search and filter history

## User Interface Design

### Design System
- **Primary Color**: Persian Blue (#1e40af)
- **Accent Color**: Phoenix Amber (#f59e0b)
- **Background**: Neutral gray scale
- **Typography**: Inter font family
- **Components**: Radix UI with custom styling

### Page Structure
```
/                    - Dashboard with recent RFQs
/settings           - Company profile management
/rfq/upload         - New RFQ upload
/rfq/[id]/fill      - Fill RFQ form
/rfq/[id]/review    - Review before generation
/history            - All RFQ history
```

## API Endpoints

### Company Profile
- `GET /api/company-profile` - Retrieve profile
- `POST /api/company-profile` - Create profile
- `PUT /api/company-profile` - Update profile

### RFQ Processing
- `POST /api/rfq/upload` - Upload PDF to S3
- `POST /api/rfq/extract` - Extract fields with AI
- `GET /api/rfq/[id]` - Get RFQ details
- `POST /api/rfq/[id]/fill` - Auto-fill from profile
- `POST /api/rfq/[id]/generate` - Generate response PDF

### History
- `GET /api/history` - List all RFQs
- `GET /api/history/[id]` - Get specific history

## Security & Compliance

### Data Protection
- Encrypted S3 storage
- HTTPS only communication
- Environment variable secrets
- No credentials in code

### Access Control
- Initially no auth (trusted environment)
- Future: NextAuth.js integration
- Audit logging for all actions

## Performance Requirements

### Speed Targets
- Profile save: < 500ms
- PDF upload: < 5 seconds
- AI extraction: < 10 seconds
- Auto-fill: < 1 second
- PDF generation: < 5 seconds

### Scalability
- Handle PDFs up to 50MB
- Process 10+ RFQs daily
- Store 1000+ historical RFQs
- Support 2-10 concurrent users

## Error Handling

### User-Facing Errors
- Clear error messages
- Suggested fixes
- Retry mechanisms
- Fallback to manual entry

### System Errors
- Comprehensive logging
- Error boundaries
- Graceful degradation
- Admin notifications

## Future Enhancements (Post-MVP)

### Phase 2: Email Integration
- Graph API connection
- Auto-import RFQs from inbox
- Email response capability
- Attachment handling

### Phase 3: Award Tracking
- Award notification parsing
- Win/loss analytics
- Proposal success metrics
- Competitive intelligence

### Phase 4: Advanced Features
- Multi-user collaboration
- Template management
- Vendor library
- Compliance checking
- Price analysis

## Success Metrics

### Primary KPIs
- Time per RFQ: < 5 minutes (from 45)
- Accuracy rate: > 95%
- User satisfaction: > 90%
- System uptime: > 99%

### Secondary Metrics
- RFQs processed per day
- Fields auto-filled percentage
- Error rate reduction
- Submission success rate

## Development Timeline

### Week 1: Foundation
- Project setup ✓
- Database schema ✓
- Company profile CRUD
- Basic UI components

### Week 2: Core Features
- S3 integration
- PDF upload flow
- AI extraction pipeline
- Auto-fill logic

### Week 3: Generation & Polish
- PDF generation
- History tracking
- Error handling
- Testing

### Week 4: Deployment
- Vercel deployment
- Production testing
- User training
- Documentation

## Testing Strategy

### Unit Tests
- Validation schemas
- Field mapping logic
- Database operations
- Utility functions

### Integration Tests
- API endpoints
- S3 operations
- AI extraction
- PDF generation

### E2E Tests
- Complete RFQ workflow
- Profile management
- Error scenarios
- Performance tests

## Deployment Configuration

### Environment Variables
```env
DATABASE_URL=postgresql://...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=simurgh-rfq-docs
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=https://simurgh.vercel.app
```

### Vercel Settings
- Node.js 18.x
- Build command: `npm run build`
- Output directory: `.next`
- Environment variables configured
- Custom domain (optional)

## Documentation Requirements

### User Documentation
- Quick start guide
- Profile setup walkthrough
- RFQ processing tutorial
- Troubleshooting guide

### Technical Documentation
- API reference
- Database schema
- Deployment guide
- Contributing guidelines

## Risk Mitigation

### Technical Risks
- **PDF format variations**: Multiple parsing strategies
- **AI accuracy**: Human review step
- **S3 availability**: Local backup option
- **API rate limits**: Request queuing

### Business Risks
- **User adoption**: Intuitive UI, training
- **Data loss**: Regular backups
- **Compliance issues**: Audit trail
- **Scope creep**: Strict MVP focus

This specification defines the complete Simurgh MVP system for rapid RFQ response generation.