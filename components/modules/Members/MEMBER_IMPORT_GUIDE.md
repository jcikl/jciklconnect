# Member Batch Import Guide - Complete Version

## Overview
The Member Batch Import feature allows you to quickly import multiple members with all their details by pasting TSV (Tab-Separated Values) data directly into the interface.

## Supported Fields (19 Columns)

### Column Order

| # | Column | Description | Required | Format/Options |
|---|--------|-------------|----------|----------------|
| 1 | **Name** | Full name of the member | ✅ Yes | Text |
| 2 | **Email** | Email address | ✅ Yes | Valid email format |
| 3 | **Phone** | Phone number | ❌ No | Text (e.g., +60123456789) |
| 4 | **Tier** | Membership tier | ❌ No | Probationary, Regular, Life, Guest (default: Regular) |
| 5 | **National ID** | ID/Passport number | ❌ No | Text |
| 6 | **Date of Birth** | Birth date | ❌ No | YYYY-MM-DD |
| 7 | **Gender** | Gender | ❌ No | Male, Female |
| 8 | **Address** | Full address | ❌ No | Text |
| 9 | **Emergency Contact** | Emergency contact name | ❌ No | Text |
| 10 | **Emergency Phone** | Emergency contact phone | ❌ No | Text |
| 11 | **Region** | Regional area | ❌ No | Text |
| 12 | **Nationality** | Nationality | ❌ No | Text (default: Malaysia) |
| 13 | **Company** | Company name | ❌ No | Text |
| 14 | **Position** | Job position/title | ❌ No | Text |
| 15 | **LinkedIn** | LinkedIn profile URL | ❌ No | URL |
| 16 | **Facebook** | Facebook profile URL | ❌ No | URL |
| 17 | **Instagram** | Instagram handle | ❌ No | Text |
| 18 | **WeChat** | WeChat ID | ❌ No | Text |
| 19 | **Hobbies** | Interests/hobbies | ❌ No | Comma-separated (e.g., "Golf,Reading,Yoga") |

## How to Use

### Step 1: Prepare Your Data
Create a spreadsheet (Excel, Google Sheets, etc.) with 19 columns in the exact order shown above.

### Step 2: Fill In Your Data
- **Required fields**: Name and Email must be filled for each row
- **Optional fields**: Leave empty if not available (use empty cell, not spaces)
- **Date format**: Use YYYY-MM-DD (e.g., 1990-05-15)
- **Hobbies**: Separate multiple hobbies with commas

### Step 3: Copy the Data
1. Select all data rows (including all 19 columns)
2. Do NOT include the header row
3. Copy the selection (Ctrl+C or Cmd+C)

### Step 4: Open Import Modal
1. Navigate to Members → Member Directory
2. Click the "Import" button in the top right corner

### Step 5: Paste and Review
1. Paste your data into the text area (Ctrl+V or Cmd+V)
2. The system will automatically:
   - Remove any quotation marks
   - Parse all 19 columns
   - Validate required fields and formats
   - Show you a preview table with validation results

### Step 6: Review Tabs
Use the three tabs to review your data:
- **All**: Shows all rows with column preview
- **Valid**: Shows only rows that passed validation (green background)
- **Errors**: Shows only rows with validation errors (red background with error details)

### Step 7: Fix Errors (if any)
- Click on any row in the table to jump to that line in the text area
- Edit the data directly in the text area
- The preview will update automatically as you type

### Step 8: Column Mapping (Optional)
If your columns are in a different order:
1. Click "Show Column Mapping"
2. Adjust the column numbers (0-indexed) for each field
3. Preview will update to reflect the new mapping

### Step 9: Import
- Click "Import X members" button
- Only valid rows will be imported
- You'll see a success message with the import results

## Example Data

Here's a complete example with all 19 columns:

```
John Doe	john.doe@example.com	+60123456789	Regular	IC123456	1985-03-15	Male	123 Main St, KL	Jane Doe	+60129999999	Kuala Lumpur	Malaysia	Tech Corp	Senior Manager	https://linkedin.com/in/johndoe	https://facebook.com/johndoe	@johndoe	johndoe123	Golf,Reading,Networking
Jane Smith	jane.smith@example.com	+60129876543	Probationary	IC789012	1990-07-22	Female	456 Oak Ave, PJ	John Smith	+60128888888	Petaling Jaya	Malaysia	Finance Ltd	Executive	https://linkedin.com/in/janesmith			janesmith456	Yoga,Cooking
Bob Wilson	bob@example.com		Life	PASS654321	1975-12-01	Male	789 Pine Rd, Subang		+60127777777	Subang Jaya	Malaysia	Wilson Consulting	Director					Traveling,Photography
```

## Validation Rules

### Required Fields
- **Name**: Cannot be empty
- **Email**: Cannot be empty and must be valid email format (user@domain.com)

### Optional Fields with Validation
- **Tier**: If provided, must be exactly one of: Probationary, Regular, Life, Guest
- **Date of Birth**: If provided, must be in YYYY-MM-DD format
- **Gender**: If provided, must be exactly: Male or Female

### Default Values
- **Tier**: Regular (if empty)
- **Nationality**: Malaysia (if empty)
- **Join Date**: Today's date (automatically set)
- **Status**: Active (automatically set)

## Tips & Best Practices

1. **Template First**: Create a template in Excel/Google Sheets with all 19 column headers
2. **Batch Size**: Import 50-100 members at a time for best performance
3. **Empty Columns**: Leave cells empty for optional fields (don't use "N/A" or "-")
4. **Quote Removal**: System automatically removes quotation marks - don't worry about CSV formatting
5. **Click to Navigate**: Click any row in the preview table to jump to that line in the text area
6. **Social Media**: Include full URLs for LinkedIn and Facebook
7. **Hobbies**: Use comma separation without spaces after commas (e.g., "Golf,Reading,Yoga")
8. **Date Format**: Always use YYYY-MM-DD format (e.g., 1990-05-15, not 15/05/1990)

## Troubleshooting

### Common Errors

#### "Missing name" or "Missing email"
- **Cause**: Required field is empty
- **Solution**: Fill in the name or email for that row

#### "Invalid email format"
- **Cause**: Email doesn't match standard format
- **Solution**: Verify email is correct (e.g., user@domain.com)
- **Common issues**: Missing @, missing domain, extra spaces

#### "Invalid tier"
- **Cause**: Tier value doesn't match accepted values
- **Solution**: Use exactly: Probationary, Regular, Life, or Guest
- **Note**: Case-sensitive, check for typos

#### "Invalid date format for DOB"
- **Cause**: Date is not in YYYY-MM-DD format
- **Solution**: Reformat date to YYYY-MM-DD (e.g., 1990-05-15)

#### "Invalid gender"
- **Cause**: Gender value is not "Male" or "Female"
- **Solution**: Use exactly: Male or Female
- **Note**: Case-sensitive

### Data Not Appearing

#### No preview shown after pasting
- **Check**: Ensure you're using Tab-separated values
- **Solution**: Copy directly from Excel/Google Sheets (don't convert to CSV first)
- **Tip**: Each row should have exactly 19 tab-separated columns

#### Columns misaligned
- **Cause**: Column order doesn't match expected order
- **Solution**: Click "Show Column Mapping" and adjust column numbers
- **Note**: Column numbers are 0-indexed (first column = 0)

## Import Statistics

After import, you'll see:
- **Total rows**: Number of rows in your data
- **Valid**: Number of rows that will be imported
- **Errors**: Number of rows with validation errors

Only valid rows will be imported. Invalid rows will be skipped with error details shown.

## Excel/Google Sheets Template

Create a spreadsheet with these headers:

| Name | Email | Phone | Tier | National ID | DOB | Gender | Address | Emerg. Contact | Emerg. Phone | Region | Nationality | Company | Position | LinkedIn | Facebook | Instagram | WeChat | Hobbies |
|------|-------|-------|------|-------------|-----|--------|---------|----------------|--------------|--------|-------------|---------|----------|----------|----------|-----------|--------|---------|

Then fill in your data and copy (excluding the header row).

## Need Help?

If you encounter any issues:
1. Check this guide for validation rules
2. Use the preview table to identify specific errors
3. Click on error rows to quickly navigate and fix them
4. Contact the system administrator for additional support

## Advanced: Column Mapping

Default column mapping (0-indexed):
- 0: Name
- 1: Email
- 2: Phone
- 3: Tier
- 4: National ID
- 5: Date of Birth
- 6: Gender
- 7: Address
- 8: Emergency Contact
- 9: Emergency Phone
- 10: Region
- 11: Nationality
- 12: Company
- 13: Position
- 14: LinkedIn
- 15: Facebook
- 16: Instagram
- 17: WeChat
- 18: Hobbies

If your data has a different column order, use the Column Mapping feature to adjust.
