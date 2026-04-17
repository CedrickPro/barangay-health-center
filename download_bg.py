import urllib.request
import re
import os

def download_image():
    url = "https://ph.pinterest.com/pin/22658804368798994/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        # Create static directory if it doesn't exist
        os.makedirs('static', exist_ok=True)
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('utf-8')
            
        # Look for the og:image meta tag
        match = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', html)
        if not match:
            match = re.search(r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"', html)
            
        if match:
            img_url = match.group(1)
            print(f"Found image URL: {img_url}")
            
            # Download the image
            img_req = urllib.request.Request(img_url, headers=headers)
            with urllib.request.urlopen(img_req) as img_response:
                with open('static/bg-login.jpg', 'wb') as f:
                    f.write(img_response.read())
            print("Successfully downloaded to static/bg-login.jpg")
            return True
        else:
            print("Could not find image URL in the page.")
            return False
            
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    download_image()
