import json
import boto3
import csv
from io import StringIO
from datetime import datetime
import os

def lambda_handler(event, context):
    # Initialize S3 client
    s3 = boto3.client('s3')
    
    try:
        # Get source bucket and file details from the event
        source_bucket = event['Records'][0]['s3']['bucket']['name']
        file_key = event['Records'][0]['s3']['object']['key']
        
        print(f"Processing file: {file_key} from bucket: {source_bucket}")
        
        # Get file extension
        _, file_extension = os.path.splitext(file_key)
        
        # Get the file content
        response = s3.get_object(Bucket=source_bucket, Key=file_key)
        file_content = response['Body'].read().decode('utf-8')
        
        # Process based on file type
        if file_extension.lower() in ['.txt', '.csv']:
            sorted_content = process_csv_content(file_content)
            content_type = 'text/csv'
        else:
            sorted_content = process_text_content(file_content)
            content_type = 'text/plain'
        
        # Generate output file name with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = os.path.splitext(file_key)[0]
        output_key = f"sorted_{timestamp}_{base_name}.srt"
        
        # Upload sorted file to output bucket
        s3.put_object(
            Bucket='sortout-nirajan-0921977',
            Key=output_key,
            Body=sorted_content,
            ContentType=content_type,
            Metadata={
                'sorted': 'true',
                'original-filename': file_key,
                'processing-date': timestamp
            }
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'File processed successfully',
                'input_file': file_key,
                'output_file': output_key
            })
        }
        
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'file_key': file_key if 'file_key' in locals() else 'Unknown'
            })
        }

def process_csv_content(content):
    input_file = StringIO(content)
    csv_reader = csv.reader(input_file)
    rows = list(csv_reader)
    
    if not rows:
        raise ValueError("No data found in the file")
    
    # Sort rows by first column
    sorted_rows = sorted(rows, key=lambda x: x[0].lower() if x and x[0] else '')
    
    output_file = StringIO()
    csv_writer = csv.writer(output_file, lineterminator='\n')
    csv_writer.writerows(sorted_rows)
    
    return output_file.getvalue()

def process_text_content(content):
    lines = content.splitlines()
    sorted_lines = sorted(lines, key=str.lower)
    return '\n'.join(sorted_lines) 