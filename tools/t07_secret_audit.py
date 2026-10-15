#!/usr/bin/env python3
"""Audit every Git blob reachable from any ref; never print secret values."""
import re
import subprocess
import sys

SIGNATURES = {
    "Supabase server secret": re.compile(rb"\bsb_secret_[A-Za-z0-9_-]{12,}\b"),
    "PEM private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "Bearer JWT": re.compile(rb"(?i)Bearer\s+eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}"),
    "Server-only secret assignment": re.compile(rb"(?i)\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|JWT_SIGNING_SECRET|JWT_SECRET)\b\s*[:=]\s*[\"']?\s*(?:eyJ[A-Za-z0-9_.-]{30,}|[A-Za-z0-9_+/-]{48,})"),
    "Persisted bcrypt password hash": re.compile(rb"\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}"),
}

def git(*args):
    result = subprocess.run(["git", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError("Git inspection failed")
    return result.stdout

def main():
    try:
        lines = git("rev-list", "--objects", "--all").decode("utf-8", "replace").splitlines()
        if not lines:
            raise RuntimeError("No repository objects")
        seen, scanned, total_bytes, findings = set(), 0, 0, []
        for line in lines:
            sha = line.split(" ", 1)[0]
            if sha in seen:
                continue
            seen.add(sha)
            if git("cat-file", "-t", sha).strip() != b"blob":
                continue
            size = int(git("cat-file", "-s", sha))
            if size > 4000000:
                raise RuntimeError("Oversize object requires audit: " + sha[:12])
            body = git("cat-file", "blob", sha)
            scanned += 1
            total_bytes += size
            for kind, pattern in SIGNATURES.items():
                if pattern.search(body):
                    findings.append((sha[:12], kind))
        print("Full-history public-source audit")
        print("Unique Git objects:", len(seen))
        print("Blobs checked:", scanned)
        print("Bytes checked:", total_bytes)
        if findings:
            for short_sha, kind in findings:
                print("FAIL:", kind, short_sha)
            return 1
        print("PASS: No secret-value signatures in any reachable Git blob.")
        return 0
    except Exception as error:
        print("INCOMPLETE:", str(error), file=sys.stderr)
        return 2

if __name__ == "__main__":
    sys.exit(main())
