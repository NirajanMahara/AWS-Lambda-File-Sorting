# AWS Lambda File Sorting Application

## Project Overview
A serverless web application that allows users to upload CSV files containing user data, automatically sorts the content by name (first column), and displays the sorted results. Built using AWS Lambda, S3 buckets, and a responsive web interface.

## Features
- Upload CSV files through a web interface
- Real-time progress indication
- Automatic sorting of user data by name
- Error handling and validation
- Mobile-responsive design

## Live Demo
- Frontend URL: [Your hosted frontend URL]
- Test Credentials: Not required (uses anonymous access)

## Technical Stack
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: AWS Lambda (Python)
- **Storage**: AWS S3
- **Authentication**: AWS Cognito (anonymous)

## Implementation Details
The page uses AWS SDK for JavaScript to interact with S3.


### AWS S3 Buckets
- Input Bucket: sortin-nirajan-0921977
- Output Bucket: sortout-nirajan-0921977
- Ensure both buckets have the correct CORS configuration and permissions to allow the Lambda function to read from the input bucket and write to the output bucket.

### AWS Lambda Function: `lambda_function.py`
- is set up to:
  - Trigger on file uploads to the SortIn bucket.
  - Read, sort, and write the file to the SortOut bucket with a .srt extension.

- Processes CSV files containing user data with fields:
  - Name
  - Address
  - Suite/Apt
  - City
  - Country
  - Phone
  - Age
  - Occupation
  - UUID
  - Date of Birth

### Web Interface
- Simple, intuitive upload interface
- Progress bar for upload status
- Sorted results display
- Error messaging system

## Setup Instructions

1. **Clone the Repository**
```bash
git clone [repository-url]
cd [repository-name]
```

2. **Configure AWS Credentials**
- Update `app.js` with your AWS configuration:
```javascript
AWS.config.region = 'ca-central-1';
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'YOUR-IDENTITY-POOL-ID'
});
```

3. **Deploy Frontend**
- Host the following files on a web server:
  - index.html
  - styles.css
  - app.js

4. **Test the Application**
- Open the web interface
- Upload a CSV file
- Wait for processing
- View sorted results

## Usage Example
1. Prepare a CSV or Excel text file with user data
2. Click "Choose File" on the web interface
3. Select your CSV or Excel text file
4. Click "Upload File"
5. Wait for processing (progress bar will indicate status)
6. View the sorted results displayed on the page

## Error Handling
The application handles several error cases:
- Invalid file types
- Empty files
- Network errors
- Processing failures

## Security
- S3 buckets are properly configured with CORS
- Lambda function has minimal required permissions
- Frontend uses temporary credentials via Cognito

## Known Limitations
- Maximum file size: 10MB
- Supports CSV format only
- Sorting is done by first column only

## Troubleshooting
Common issues and solutions:
1. File not uploading
   - Check file format and size
   - Verify AWS credentials
2. Results not displaying
   - Check browser console for errors
   - Verify S3 bucket permissions

## Project Structure
```
project/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── lambda/
│   └── lambda_function.py
├── docs/
│   └── README.md
└── aws/
    └── policies/
        ├── cognito-unauth-policy.json
        └── lambda-execution-role.json
```

## AWS Configuration Files

### CORS Configuration for S3 Buckets
```json
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["PUT", "POST", "GET"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": []
        }
    ]
}
```

## Development Notes
- Frontend uses vanilla JavaScript for simplicity
- Lambda function processes files asynchronously
- Error handling implemented throughout the stack

## Testing
Tested with:
- Various file sizes
- Different CSV formats
- Error scenarios
- Cross-browser compatibility

## Author
- Name: Nirajan Mahara
- Student ID: 0921977

## Support
For issues or questions, please contact:
- Email: c0921977@my.lambton.ca

## Project Status
- Development: Complete
- Testing: In Progress
- Documentation: Complete
