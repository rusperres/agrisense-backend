# src/jobs/scrapers/ncr/python_scripts/extract_tables_tabula.py
import tabula
import sys
import json
import os
import numpy as np # Import numpy to handle NaN values

def extract_tables_from_pdf(pdf_path):
    """
    Extracts tables from a PDF file using tabula-py.
    Attempts to use both lattice and stream mode for robustness.
    """
    try:
        # Try lattice mode first (for PDFs with clear lines)
        df_list = tabula.read_pdf(pdf_path, pages='all', lattice=True, multiple_tables=True, stream=False)
        if not df_list:
            # If no tables found with lattice, try stream mode (for PDFs without clear lines)
            df_list = tabula.read_pdf(pdf_path, pages='all', stream=True, multiple_tables=True, lattice=False)

        all_extracted_data = []
        for df in df_list:
            df_processed = df.copy()
            # Convert NaN values to None (which JSON serializes as null)
            df_processed = df_processed.replace({np.nan: None})
            # No .astype(str) here, so numbers will remain numbers, etc.
            all_extracted_data.extend(df_processed.to_dict(orient='records'))

        print(json.dumps(all_extracted_data))

    except Exception as e:
        # Print error to stderr so Node.js can catch it
        error_message = {"error": "PDF extraction failed", "message": str(e)}
        print(json.dumps(error_message), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        error_message = {"error": "No PDF path provided", "message": "Usage: python extract_tables_tabula.py <pdf_path>"}
        print(json.dumps(error_message), file=sys.stderr)
        sys.exit(1)

    pdf_file_path = sys.argv[1]
    if not os.path.exists(pdf_file_path):
        error_message = {"error": "File not found", "message": f"PDF file not found at: {pdf_file_path}"}
        print(json.dumps(error_message), file=sys.stderr)
        sys.exit(1)

    extract_tables_from_pdf(pdf_file_path)
