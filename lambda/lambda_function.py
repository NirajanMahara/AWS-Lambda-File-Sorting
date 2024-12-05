import json
import boto3
import csv
from io import StringIO
from datetime import datetime

def lambda_handler(event, context):
    # Initialize S3 client
    s3 = boto3.client('s3')
    
    try:
        # Get source bucket and file details from the event
        source_bucket = event['Records'][0]['s3']['bucket']['name']
        file_key = event['Records'][0]['s3']['object']['key']
        
        print(f"Processing file: {file_key} from bucket: {source_bucket}")
        
        # Get the file from source bucket
        response = s3.get_object(Bucket=source_bucket, Key=file_key)
        file_content = response['Body'].read().decode('utf-8')
        
        # Parse CSV content
        input_file = StringIO(file_content)
        csv_reader = csv.reader(input_file)
        rows = list(csv_reader)
        
        if not rows:
            raise ValueError("No data found in the file")
        
        # Sort rows by first column (name) case-insensitively
        sorted_rows = sorted(rows, key=lambda x: x[0].lower() if x and x[0] else '')
        
        # Prepare output content
        output_file = StringIO()
        csv_writer = csv.writer(output_file, lineterminator='\n')  # Explicit line terminator
        csv_writer.writerows(sorted_rows)
        
        # Generate output file name with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_key = f"sorted_{timestamp}_{file_key}"
        
        # Upload sorted file to output bucket
        s3.put_object(
            Bucket='sortout-nirajan-0921977',
            Key=output_key,
            Body=output_file.getvalue(),
            ContentType='text/csv',
            Metadata={
                'sorted': 'true',
                'original-filename': file_key,
                'processing-date': timestamp
            }
        )
        
        print(f"Successfully processed and uploaded: {output_key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'File processed successfully',
                'input_file': file_key,
                'output_file': output_key
            })
        }
        
    except Exception as e:
        error_message = str(e)
        print(f"Error processing file: {error_message}")
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': error_message,
                'file_key': file_key if 'file_key' in locals() else 'Unknown'
            })
        } 