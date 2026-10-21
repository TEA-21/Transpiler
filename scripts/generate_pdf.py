import os
import base64
import subprocess
import shutil

def main():
    docs_dir = os.path.abspath('docs')
    html_src = os.path.join(docs_dir, 'review_2_report.html')
    html_dist = os.path.join(docs_dir, 'review_2_report_compiled.html')
    logo_path = os.path.join(docs_dir, 'vit_logo.png')

    logo_tag = ''
    if os.path.exists(logo_path):
        with open(logo_path, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode('utf-8')
            logo_tag = f'<img src="data:image/png;base64,{b64}" class="header-logo" alt="VIT Logo" />'

    with open(html_src, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace('<!--VIT_LOGO_PLACEHOLDER-->', logo_tag)

    with open(html_dist, 'w', encoding='utf-8') as f:
        f.write(content)

    # Browser executable lookup
    candidates = [
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    ]
    browser = next((c for c in candidates if os.path.exists(c)), None)
    if not browser:
        print('Error: Chrome or Edge executable not found.')
        return

    out_root = os.path.abspath('Review 2 Documentation - Transpiler.pdf')
    out_docs = os.path.join(docs_dir, 'Review_2_Documentation.pdf')

    cmd = [
        browser,
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        f'--print-to-pdf={out_root}',
        html_dist,
    ]

    print(f'Compiling PDF with: {browser}')
    subprocess.run(cmd, check=True)
    print(f'Generated: {out_root}')

    shutil.copy(out_root, out_docs)
    print(f'Copied to: {out_docs}')

if __name__ == '__main__':
    main()
