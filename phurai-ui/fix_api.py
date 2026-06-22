import os, re
pattern = re.compile(r"(request|apiGet|apiPatch|apiPut|apiPost|managerAuthRequest)\(([\"\'\`])/api/")
count = 0
for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith(".js") or file.endswith(".jsx"):
            path = os.path.join(root, file)
            with open(path, "r") as f:
                content = f.read()
            if pattern.search(content):
                new_content = pattern.sub(r"\1(\2/", content)
                with open(path, "w") as f:
                    f.write(new_content)
                print(f"Fixed: {path}")
                count += 1
print(f"Total files fixed: {count}")
