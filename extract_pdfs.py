import pypdf
import sys
import os

def extract_text(pdf_path):
    print(f'--- {pdf_path} ---')
    if not os.path.exists(pdf_path):
        print(f"File not found: {os.path.abspath(pdf_path)}")
        return
    try:
        reader = pypdf.PdfReader(pdf_path)
        for i, page in enumerate(reader.pages):
            print(f'Page {i+1}:')
            print(page.extract_text())
            print('-' * 20)
    except Exception as e:
        print(f'Error reading {pdf_path}: {e}')

base_path = 'projeto-salao/public/pdfs'
extract_text(os.path.join(base_path, 'Manual_Terapia_Capilar_Jak_Oliveira_Atualizado.pdf'))
extract_text(os.path.join(base_path, 'Orcamento_Terapia_Capilar_Jak_Oliveira.pdf'))
