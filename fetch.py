import urllib.request
import re
try:
    req = urllib.request.Request("https://ph.pinterest.com/pin/22658804368798994/", headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    m = re.search(r'"og:image"\s+content="([^"]+)"', html)
    if m:
        img_url = m.group(1)
        print("Downloading:", img_url)
        urllib.request.urlretrieve(img_url, 'static/bg-login2.jpg')
    else:
        print("No og:image found.")
except Exception as e:
    print("Error:", str(e))
