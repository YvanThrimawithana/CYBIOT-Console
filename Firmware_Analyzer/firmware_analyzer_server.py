# this is me the developer
# Author: GitHub Copilot
# A comprehensive firmware analysis tool for security research

#!/usr/bin/env python3

import sys
import subprocess
import os
import re
import binwalk
import magic  # for file type detection
import mmap   # for memory-efficient file reading
import codecs # for text file handling
import time
import socket
import threading
import queue
import requests
import json
from collections import Counter
import math
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from capstone import *
import aiohttp
import asyncio
from functools import lru_cache
import numpy as np
from concurrent.futures import ProcessPoolExecutor
import pickle
from datetime import datetime, timedelta
from tqdm import tqdm
import lzma
import struct
import shutil
import fnmatch
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import werkzeug.utils
import tempfile

def check_dependencies():
    missing_deps = []
    try:
        import binwalk
    except ImportError:
        missing_deps.append("binwalk (install with: sudo apt-get install binwalk)")
    try:
        import capstone
    except ImportError:
        missing_deps.append("capstone (install with: pip install capstone)")
    
    if missing_deps:
        print("Missing required dependencies:")
        for dep in missing_deps:
            print(f"- {dep}")
        sys.exit(1)

# Run dependency check first
check_dependencies()

# Import required modules
import argparse

# Add these constants
NVD_API_KEY = "76bf1b33-a7bb-463c-bb77-c2cbec512a5f"
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')
VULN_CACHE_FILE = os.path.join(CACHE_DIR, 'nvd_cache.pkl')
CACHE_EXPIRY = 24  # hours
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
RESULTS_DIR = os.path.join(os.path.dirname(__file__), 'results')
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

app = Flask(__name__)
CORS(app)

@app.route('/analyze', methods=['POST'])
def analyze_firmware():
    if 'firmware' not in request.files:
        return jsonify({'error': 'No firmware file provided'}), 400
    
    firmware_file = request.files['firmware']
    if firmware_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        # Save uploaded file with secure filename
        firmware_path = os.path.join(UPLOAD_DIR, werkzeug.utils.secure_filename(firmware_file.filename))
        firmware_file.save(firmware_path)
        
        # Extract and analyze firmware
        extracted_dir = extract_firmware(firmware_path)
        all_vulnerabilities = []
        all_files = []
        total_size = 0
        
        # Collect files for analysis
        for root, _, files in os.walk(extracted_dir):
            for file in files:
                full_path = os.path.join(root, file)
                try:
                    if os.path.splitext(file)[1].lower() in {'.jpg', '.png', '.gif', '.mp3', '.mp4'}:
                        continue
                    size = os.path.getsize(full_path)
                    if size < 64 or size > 10_000_000:
                        continue
                    total_size += size
                    if total_size > 500 * 1024 * 1024:
                        break
                    all_files.append(full_path)
                except:
                    continue
        
        # Process files in chunks
        chunk_size = 50
        for i in range(0, len(all_files), chunk_size):
            chunk = all_files[i:i + chunk_size]
            vulns = parallel_file_scan(chunk, verbose=False)
            if vulns:
                all_vulnerabilities.extend(vulns)
        
        # Generate and save JSON report
        report = generate_report(all_vulnerabilities, output_json=True)
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        result_filename = f"{os.path.splitext(firmware_file.filename)[0]}_{timestamp}_results.json"
        result_path = os.path.join(RESULTS_DIR, result_filename)
        
        with open(result_path, 'w') as f:
            f.write(report)
        
        # Clean up
        try:
            shutil.rmtree(extracted_dir)
            os.remove(firmware_path)
        except:
            pass
        
        # Send the results file
        return send_file(
            result_path,
            mimetype='application/json',
            as_attachment=True,
            download_name=result_filename
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Function to extract firmware using binwalk
def extract_firmware(firmware_path):
    print("Analyzing firmware...")
    
    # Create extraction directory if it doesn't exist
    base_name = os.path.splitext(os.path.basename(firmware_path))[0]
    extract_dir = f"_{base_name}.extracted"
    if not os.path.exists(extract_dir):
        os.makedirs(extract_dir)

    # First try binwalk extraction
    try:
        subprocess.run(['binwalk', '-e', '-M', '--run-as=root', 
                       '-C', extract_dir, firmware_path], 
                      check=True, capture_output=True)
    except:
        print("Binwalk extraction failed, trying alternative methods...")
    
    # Handle LZMA compressed data
    try:
        with open(firmware_path, 'rb') as f:
            data = f.read()
        
        
        # Try to extract LZMA at offset 66560
        lzma_data = data[66560:]
        decompressed = lzma.decompress(lzma_data)
        with open(os.path.join(extract_dir, "kernel.bin"), 'wb') as f:
            f.write(decompressed)
        
        # Try to extract SquashFS at offset 1049088
        squashfs_data = data[1049088:]
        squashfs_file = os.path.join(extract_dir, "rootfs.squashfs")
        with open(squashfs_file, 'wb') as f:
            f.write(squashfs_data)
        
        # Extract SquashFS
        os.makedirs(os.path.join(extract_dir, "squashfs-root"), exist_ok=True)
        subprocess.run(['unsquashfs', '-d', 
                       os.path.join(extract_dir, "squashfs-root"),
                       squashfs_file], check=False)
    except Exception as e:
        print(f"Alternative extraction method failed: {e}")

    return extract_dir

# Function to disassemble code sections using capstone
def disassemble_code(file_path):
    try:
        with open(file_path, 'rb') as f:
            code = f.read()
        # Only try to disassemble if file seems to contain code
        if any(binary in code for binary in [b'\x7fELF', b'\x7FELF']):
            md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
            disassembled = []
            for i in md.disasm(code, 0x1000):
                disassembled.append(f"0x{i.address:x}:\t{i.mnemonic}\t{i.op_str}")
            return disassembled
        return []
    except Exception as e:
        print(f"Note: Couldn't disassemble {file_path}: {str(e)}")
        return []

def is_binary_file(file_path):
    """Check if file is binary."""
    try:
        with open(file_path, 'tr') as check_file:
            check_file.read(1024)
            return False
    except:
        return True

@lru_cache(maxsize=1000)
async def fetch_nvd_vulnerabilities(component=None):
    """Fetch vulnerabilities from NVD API with caching"""
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    
    # Check cache first
    if os.path.exists(VULN_CACHE_FILE):
        cache_time = datetime.fromtimestamp(os.path.getmtime(VULN_CACHE_FILE))
        if datetime.now() - cache_time < timedelta(hours=CACHE_EXPIRY):
            with open(VULN_CACHE_FILE, 'rb') as f:
                return pickle.load(f)

    headers = {
        'apiKey': NVD_API_KEY,
        'Content-Type': 'application/json'
    }
    
    async with aiohttp.ClientSession() as session:
        params = {
            'resultsPerPage': 2000,
            'pubStartDate': (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d'),
            'keyword': component or 'firmware'
        }
        
        async with session.get(
            'https://services.nvd.nist.gov/rest/json/cves/2.0',
            headers=headers,
            params=params
        ) as response:
            if response.status == 200:
                data = await response.json()
                # Cache the results
                with open(VULN_CACHE_FILE, 'wb') as f:
                    pickle.dump(data, f)
                return data
    return None

def detect_zero_day_patterns(binary_data, strings_found):
    """Detect potential zero-day vulnerabilities using statistical analysis"""
    indicators = []
    
    # Calculate entropy distribution
    chunk_size = 256
    chunks = [binary_data[i:i+chunk_size] for i in range(0, len(binary_data), chunk_size)]
    entropies = [calculate_entropy(chunk) for chunk in chunks]
    
    # Detect anomalous patterns
    mean_entropy = np.mean(entropies)
    std_entropy = np.std(entropies)
    
    for i, entropy in enumerate(entropies):
        if entropy > mean_entropy + 2 * std_entropy:
            indicators.append({
                'type': 'Potential Zero-day',
                'confidence': 'HIGH',
                'details': f'Anomalous entropy pattern at offset {i*chunk_size}',
                'entropy': entropy
            })
    
    # Analyze string patterns for potential exploits
    exploit_patterns = [
        (r'(?i)overflow', 0.9),
        (r'(?i)race\s*condition', 0.85),
        (r'(?i)use\s*after\s*free', 0.9),
        (r'(?i)double\s*free', 0.9),
        (r'(?i)memory\s*corruption', 0.85)
    ]
    
    for string in strings_found:
        for pattern, confidence in exploit_patterns:
            if re.search(pattern, string):
                indicators.append({
                    'type': 'Potential Zero-day',
                    'confidence': confidence,
                    'details': f'Possible exploit pattern: {string[:100]}',
                    'pattern': pattern
                })
    
    return indicators

def load_local_vulnerability_database():
    """Load and update local vulnerability database"""
    db_path = os.path.join(os.path.dirname(__file__), 'vuln_db.json')
    try:
        if os.path.exists(db_path):
            with open(db_path, 'r') as f:
                return json.load(f)
    except:
        pass
    return {}

def check_password_file(file_path):
    """Analyze potential password files for weak/default credentials"""
    vulnerabilities = []
    password_files = ['passwd', 'shadow', 'passwd.bak', 'shadow.bak']

    if any(pfile in file_path.lower() for pfile in password_files):
        try:
            with open(file_path, 'r', errors='ignore') as f:
                content = f.read()
                # Parse each line of the password file
                for line_num, line in enumerate(content.splitlines(), 1):
                    if not line.strip():
                        continue
                    parts = line.split(':')
                    if len(parts) >= 2:
                        username = parts[0]
                        password = parts[1]
        
                        # Check for various credential patterns
                        if username == 'admin':
                            vulns = {
                                '': 'Empty admin password',
                                'admin': 'Default admin:admin credentials',
                                '1234': 'Default TP-Link credentials (admin/1234)',
                                '$1$': 'MD5 hashed admin password'
                            }
                            for pwd, desc in vulns.items():
                                if pwd in password:
                                    vulnerabilities.append({
                                        "type": "Default/Weak Credentials",
                                        "file": os.path.basename(file_path),
                                        "line": line_num,
                                        "match": f"{desc} - Found '{username}:{password}'",
                                        "severity": "HIGH"
                                    })
                        
                        # Check for empty root password
                        if username == 'root' and not password:
                            vulnerabilities.append({
                                "type": "Default/Weak Credentials",
                                "file": os.path.basename(file_path),
                                "line": line_num,
                                "match": f"Empty root password - Found '{username}:{password}'",
                                "severity": "HIGH"
                            })
                        
                        # Check for known weak passwords
                        if password in ['', 'root', 'admin', '1234', 'password']:
                            vulnerabilities.append({
                                "type": "Default/Weak Credentials",
                                "file": os.path.basename(file_path),
                                "line": line_num,
                                "match": f"Weak password for user '{username}' - Found '{username}:{password}'",
                                "severity": "HIGH"
                            })
        except Exception as e:
            print(f"Error analyzing password file {file_path}: {e}")
    
    return vulnerabilities

def get_dangerous_libs():
    """Return dictionary of known dangerous library versions"""
    return {
        'openssl': {
            'dangerous_versions': ['0.9.', '1.0.0', '1.0.1', '1.0.2'],
            'reason': 'Multiple critical vulnerabilities including Heartbleed'
        },
        'busybox': {
            'dangerous_versions': ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6'],
            'reason': 'Multiple command injection vulnerabilities'
        },
        'dropbear': {
            'dangerous_versions': ['0.', '2015', '2016', '2017'],
            'reason': 'Multiple authentication bypass vulnerabilities'
        },
        'dnsmasq': {
            'dangerous_versions': ['2.7', '2.6', '2.5'],
            'reason': 'Multiple RCE vulnerabilities'
        },
        'uClibc': {
            'dangerous_versions': ['0.9.32', '0.9.33'],
            'reason': 'Format string vulnerabilities and buffer overflows'
        },
        'iptables': {
            'dangerous_versions': ['1.4', '1.3'],
            'reason': 'Multiple security bypass vulnerabilities'
        },
        'miniupnpd': {
            'dangerous_versions': ['1.0', '1.1', '1.2', '1.3', '1.4'],
            'reason': 'Buffer overflow vulnerabilities'
        },
        'thttpd': {
            'dangerous_versions': ['2.25', '2.24'],
            'reason': 'Directory traversal vulnerabilities'
        },
        'mt7628': {  # Add router-specific library checks
            'dangerous_versions': ['4l_v15', '4l_v14'],
            'reason': 'Known buffer overflow in Wi-Fi driver'
        }
    }

def scan_file_content(file_path, verbose=False):
    vulnerabilities = []
    try:
        # First check if it's a password file
        pwd_vulns = check_password_file(file_path)
        if pwd_vulns:
            vulnerabilities.extend(pwd_vulns)        # Enhanced patterns for IoT firmware analysis
        patterns = {
            'hardcoded_creds': [
                # More specific password pattern to avoid normal text like "Please enter your password"
                r'(?i)(?:password|passwd)\s*[=:]\s*[\'"]([^\'"]{3,})[\'""]',
                r'(?i)(?:username|user|login)\s*[=:]\s*[\'"]([^\'"]{3,})[\'""]',
                r'(?i)(?:pass|pwd)\s*[=:]\s*[\'"]([^\'"]{3,})[\'""]',
                r'(?i)admin_pass(?:word)?\s*[=:]\s*[\'"]([^\'"]{3,})[\'""]',
                r'(?i)api_key\s*[=:]\s*[\'"]([^\'"]{8,})[\'""]',
                r'(?i)(?:secret|token)\s*[=:]\s*[\'"]([^\'"]{8,})[\'""]',
                # More specific config-style patterns
                r'(?i)define\s+[\'"]?(?:PASSWORD|PASS|PWD)[\'"]?\s+[\'"]([^\'"]{3,})[\'"]'
            ],
            'command_injection': [
                r'system\s*\([^)]+\)',
                r'exec\s*\([^)]+\)',
                r'popen\s*\([^)]+\)',
                r'shell_exec\s*\([^)]+\)',
                r'eval\s*\([^)]+\)'
            ],
            'dangerous_functions': [
                r'strcpy\s*\(',
                r'strcat\s*\(',
                r'gets\s*\(',
                r'scanf\s*\([^)]*%s[^)]*\)',
                r'printf\s*\([^)]*%n[^)]*\)'
            ],
            'dangerous_config': [
                r'(?i)debug\s*[=:]\s*(true|1|yes)',
                r'(?i)auth\s*[=:]\s*(false|0|no)',
                r'(?i)ssl_verify\s*[=:]\s*(false|0|no)',
                r'(?i)check_cert\s*[=:]\s*(false|0|no)'
            ],
            'dangerous_libs': [
                r'lib([a-z]+)[.-]([0-9.]+)',
                r'([a-z]+)_version[=: ]+["\']?([0-9.]+)',
                r'VERSION[=: ]+["\']?([0-9.]+)',
                r'([a-z-]+) version ([0-9.]+)',
                r'([a-z-]+)-([0-9.]+)\.so'
            ],
            'unsafe_libs': [
                r'telnetd',
                r'ftpd',
                r'/bin/ash',
                r'/bin/dash',
                r'libcrypt\.so\.[0-9]',
                r'libssl\.so\.[0-9]',
                r'libcrypto\.so\.[0-9]'
            ],
            'dangerous_services': [
                r'telnet\s+stream\s+tcp\s+nowait',
                r'ftp\s+stream\s+tcp\s+nowait',
                r'rsh\s+stream\s+tcp\s+nowait',
                r'/etc/init.d/(telnet|ftp|rsh)',
                r'inetd\.conf'
            ],
            'password_files': [
                r'/etc/passwd[\w.]*',
                r'/etc/shadow[\w.]*',
                r'password[._-]?backup',
                r'\.htpasswd'
            ]
        }

        # First try as text file
        try:
            with open(file_path, 'r', errors='ignore') as f:
                content = f.read()
                is_text = True
        except:
            with open(file_path, 'rb') as f:
                content = f.read().decode('latin-1')
                is_text = False

        for vuln_type, patterns_list in patterns.items():
            for pattern in patterns_list:
                matches = re.finditer(pattern, content)
                for match in matches:
                    # Filter out binary garbage matches
                    matched_text = match.group(0)
                    if len(matched_text) > 200 or (not is_text and not all(32 <= ord(c) <= 126 for c in matched_text if isinstance(c, str))):
                        continue
                        
                    line_num = content[:match.start()].count('\n') + 1
                    vulnerabilities.append({
                        "type": vuln_type.replace('_', ' ').title(),
                        "file": os.path.basename(file_path),
                        "line": line_num,
                        "match": matched_text.strip()[:60],
                    })

        # Check for library versions
        dangerous_libs = get_dangerous_libs()
        for lib_name, lib_info in dangerous_libs.items():
            if lib_name in content.lower():
                for version in lib_info.get('dangerous_versions', []):
                    if version in content:
                        vulnerabilities.append({
                            "type": "Outdated Library",
                            "file": os.path.basename(file_path),
                            "line": content[:content.find(version)].count('\n') + 1,
                            "match": f"{lib_name} version {version} - {lib_info['reason']}"
                        })
    except Exception as e:
        if verbose:
            print(f"Error scanning {file_path}: {str(e)}")
    return vulnerabilities

def scan_for_vulnerabilities(disassembled_code):
    vulnerabilities = []
    patterns = {
        'unsafe_funcs': [
            'strcpy', 'strcat', 'gets', 'sprintf', 'scanf',
            'system', 'exec', 'popen', 'shell_exec'
        ],
        'dangerous_ops': [
            'password', 'admin', 'root', 'shell', 'auth',
            'key', 'cred', 'secret'
        ]
    }

    for line in disassembled_code:
        for pattern_type, pattern_list in patterns.items():
            for pattern in pattern_list:
                if pattern.lower() in line.lower():
                    vulnerabilities.append({
                        "type": pattern_type.replace('_', ' ').title(),
                        "file": "binary",
                        "line": line.split(':')[0],
                        "match": line.strip()
                    })
    return vulnerabilities

def scan_binary_metadata(file_path):
    """Scan binary files for linked libraries and version information"""
    vulnerabilities = []
    try:
        # Use readelf to check linked libraries
        result = subprocess.run(['readelf', '-d', file_path], capture_output=True, text=True)
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if 'NEEDED' in line:
                    lib = line.split('[')[-1].split(']')[0]
                    if any(x in lib.lower() for x in ['libssl', 'libcrypto', 'libcrypt']):
                        vulnerabilities.append({
                            "type": "Potentially Unsafe Library",
                            "file": os.path.basename(file_path),
                            "line": 0,
                            "match": f"Links against {lib}"
                        })
    except:
        pass
    return vulnerabilities

def analyze_binary_patterns(file_path):
    """Use machine learning to detect potential security issues in binary files"""
    try:
        with open(file_path, 'rb') as f:
            binary_data = f.read()
            
        detector = AnomalyDetector()
        model_path = 'models/firmware_anomaly.pkl'
        
        # Extract features
        features = detector.extract_features(binary_data)
        
        # Load model or use basic detection
        if os.path.exists(model_path):
            detector.load_model(model_path)
        
        # Get detection results
        result = detector.detect_anomalies(features)
        
        if result["is_anomaly"]:
            return [{
                'type': 'ML Detection',
                'file': os.path.basename(file_path),
                'line': 0,
                'match': f'Anomalous binary patterns (confidence: {result["confidence"]:.2%})',
                'severity': 'HIGH' if result["confidence"] > 0.9 else 'MEDIUM'
            }]
        
        return []
    except Exception as e:
        logger.error(f"Binary analysis failed: {e}")
        return []

class DynamicAnalyzer:
    def __init__(self, firmware_dir, verbose=False):
        self.firmware_dir = firmware_dir
        self.verbose = verbose
        self.progress_log = []
        self.ports = queue.Queue()
        self.services = {}

    def log_progress(self, message):
        """Log progress messages"""
        timestamp = time.strftime("%H:%M:%S")
        log_msg = f"[{timestamp}] {message}"
        print(log_msg)
        self.progress_log.append(log_msg)

    def run_dynamic_analysis(self):
        """Perform dynamic analysis of the firmware"""
        findings = []
        self.log_progress("Starting dynamic analysis...")
        
        # Setup QEMU
        self.log_progress("Setting up QEMU emulation...")
        success, result = self.setup_qemu()
        if not success:
            self.log_progress(f"❌ QEMU Setup Failed: {result}")
            return findings

        kernel, rootfs = result
        self.log_progress(f"✓ Found kernel: {os.path.basename(kernel)}")
        self.log_progress(f"✓ Found rootfs: {os.path.basename(rootfs)}")
        
        # Start emulation
        try:
            self.log_progress("Starting firmware emulation...")
            with self.emulate_firmware(kernel, rootfs) as qemu:
                self.log_progress("Waiting for system to boot (30s)...")
                time.sleep(30)
                
                # Scan for open ports
                self.log_progress("Scanning for network services...")
                open_ports = self.scan_network_services()
                if open_ports:
                    self.log_progress(f"✓ Found open ports: {sorted(open_ports)}")
                    findings.append(f"Open ports discovered: {sorted(open_ports)}")
                    
                    # Fuzz discovered services
                    self.log_progress("Starting service fuzzing...")
                    for port in open_ports:
                        self.log_progress(f"  Fuzzing port {port}...")
                        fuzz_results = self.fuzz_service("127.0.0.1", port)
                        if fuzz_results:
                            self.log_progress(f"  ⚠ Found {len(fuzz_results)} potential vulnerabilities on port {port}")
                            findings.extend(fuzz_results)
                else:
                    self.log_progress("No open ports found for fuzzing")
        except Exception as e:
            self.log_progress(f"❌ Error during dynamic analysis: {str(e)}")
        
        # Generate summary
        self.log_progress("Dynamic analysis complete!")
        summary = "\nDynamic Analysis Summary:\n" + "-" * 40 + "\n"
        summary += "\n".join(self.progress_log)
        findings.append(summary)
        
        return findings

    def setup_qemu(self):
        """Setup QEMU emulation environment"""
        try:
            # Check for QEMU system emulator
            result = subprocess.run(['qemu-system-arm', '--version'], 
                                  capture_output=True, text=True)
            if result.returncode != 0:
                return False, "QEMU not found. Install with: apt-get install qemu-system-arm"
            
            # Look for kernel and rootfs with more patterns
            kernel = None
            rootfs = None
            
            # Try to find kernel first
            for root, _, files in os.walk(self.firmware_dir):
                for file in files:
                    full_path = os.path.join(root, file)
                    file_lower = file.lower()
                    
                    # Identify kernel file
                    if any(x in file_lower for x in ['vmlinux', 'kernel', 'zimage']):
                        try:
                            with open(full_path, 'rb') as f:
                                content = f.read()
                                if b'Linux version' in content:
                                    kernel = full_path
                                    break
                        except:
                            continue
                            
                    # Identify rootfs file
                    if any(x in file_lower for x in ['rootfs', 'squashfs', '.img', '.jffs2']):
                        rootfs = full_path
                
                if kernel and rootfs:
                    break
                        
            if not kernel or not rootfs:
                # Try to use extracted files
                squashfs_root = os.path.join(self.firmware_dir, "squashfs-root")
                if os.path.exists(squashfs_root):
                    rootfs = squashfs_root
                    
                kernel_bin = os.path.join(self.firmware_dir, "kernel.bin") 
                if os.path.exists(kernel_bin):
                    kernel = kernel_bin
                    
            if not kernel or not rootfs:
                return False, "Could not find kernel and rootfs files"
                
            return True, (kernel, rootfs)
            
        except Exception as e:
            return False, f"QEMU setup failed: {str(e)}"

    @contextmanager
    def emulate_firmware(self, kernel, rootfs):
        """Start firmware emulation in QEMU"""
        cmd = [
            'qemu-system-arm',
            '-M', 'virt',
            '-kernel', kernel,
            '-drive', f'file={rootfs},format=raw',
            '-append', 'root=/dev/vda console=ttyAMA0',
            '-nographic',
            '-net', 'user,hostfwd=tcp::2222-:22',
            '-net', 'nic'
        ]
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            yield process
        finally:
            process.terminate()
            process.wait()

    def port_scan(self, target, port):
        """Scan a single port"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                result = s.connect_ex((target, port))
                if result == 0:
                    self.ports.put(port)
        except:
            pass

    def scan_network_services(self, target="127.0.0.1"):
        """Scan for open network services"""
        with ThreadPoolExecutor(max_workers=50) as executor:
            for port in range(1, 10000):
                executor.submit(self.port_scan, target, port)
        open_ports = []
        while not self.ports.empty():
            open_ports.append(self.ports.get())
        
        return open_ports

    def fuzz_service(self, target, port):
        """Basic network service fuzzing"""
        payloads = [
            b"A" * 1000,
            b"%s" * 100,
            b"/../../../etc/passwd\x00",
            b"|cat /etc/passwd\x00",
            b"admin' OR '1'='1"
        ]
        findings = []
        try:
            for payload in payloads:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(2)
                    s.connect((target, port))
                    s.send(payload)
                    response = s.recv(1024)
                    if b"error" in response.lower() or b"exception" in response.lower():
                        findings.append(f"Possible vulnerability on port {port} with payload {payload[:20]}")
        except:
            pass
        return findings

def generate_report(vulnerabilities, output_json=False):
    """Generate vulnerability report with optional JSON export"""
    if not vulnerabilities:
        return "No significant vulnerabilities found."

    # Deduplicate and normalize findings
    findings = {
        'static': {
            'dangerous_libs': [],
            'unsafe_libs': [],
            'password_files': [],
            'outdated_library': [],
            'default_weak_credentials': [],
            'dangerous_config': [],
            'hardcoded_creds': [],
            'command_injection': []
        },
        'dynamic': {
            'open_ports': [],
            'fuzzing_results': [],
            'timeline': []
        }
    }

    # Process and deduplicate vulnerabilities
    seen = set()
    for vuln in vulnerabilities:
        # Create unique key for deduplication
        key = f"{vuln['type']}_{vuln.get('file', '')}_{vuln.get('line', '')}_{vuln.get('match', '')}"
        if key not in seen:
            seen.add(key)
            
            if vuln['type'] == "Dynamic Analysis":
                if 'Open ports discovered' in vuln['match']:
                    findings['dynamic']['open_ports'] = eval(vuln['match'].split(': ')[1])
                elif 'Fuzzing' in vuln['match']:
                    findings['dynamic']['fuzzing_results'].append(vuln['match'])
                else:
                    findings['dynamic']['timeline'].append(vuln['match'])
            else:
                # Map vulnerability types to categories
                category_map = {
                    'Dangerous Libs': 'dangerous_libs',
                    'Unsafe Libs': 'unsafe_libs',
                    'Password Files': 'password_files',
                    'Outdated Library': 'outdated_library',
                    'Default/Weak Credentials': 'default_weak_credentials',
                    'Dangerous Config': 'dangerous_config',
                    'Hardcoded Creds': 'hardcoded_creds',
                    'Command Injection': 'command_injection'
                }
                
                category = category_map.get(vuln['type'])
                if category:
                    findings['static'][category].append({
                        'file': vuln.get('file', ''),
                        'line': vuln.get('line', ''),
                        'match': vuln.get('match', ''),
                        'severity': vuln.get('severity', 'MEDIUM')
                    })

    if output_json:
        return json.dumps(findings, indent=2)

    # Generate text report
    report = "🔍 Vulnerability Summary\n" + "-" * 40 + "\n"
    
    # Static Analysis Results
    report += "\n📋 Static Analysis Results:\n"
    
    severity_markers = {
        "HIGH": "🔴",
        "MEDIUM": "🟡",
        "LOW": "🟢"
    }

    # Map categories to their display names and severity
    categories = [
        ('dangerous_libs', 'Dangerous Libs', 'MEDIUM'),
        ('unsafe_libs', 'Unsafe Libs', 'MEDIUM'),
        ('password_files', 'Password Files', 'HIGH'),
        ('outdated_library', 'Outdated Library', 'MEDIUM'),
        ('default_weak_credentials', 'Default/Weak Credentials', 'HIGH'),
        ('dangerous_config', 'Dangerous Config', 'MEDIUM'),
        ('hardcoded_creds', 'Hardcoded Creds', 'MEDIUM'),
        ('command_injection', 'Command Injection', 'HIGH')
    ]

    for cat_key, display_name, severity in categories:
        vulns = findings['static'][cat_key]
        if vulns:
            marker = severity_markers.get(severity, '')
            report += f"\n{marker} {display_name} ({len(vulns)} found):\n"
            for v in vulns:
                report += f"  • {v['file']}:{v['line']} - {v['match']}\n"

    # Dynamic Analysis Results
    if any(findings['dynamic'].values()):
        report += "\n🔄 Dynamic Analysis Results:\n"
        
        if findings['dynamic']['open_ports']:
            report += f"  • Open ports discovered: {findings['dynamic']['open_ports']}\n"
        
        if findings['dynamic']['fuzzing_results']:
            report += "\n".join(f"  • {result}" for result in findings['dynamic']['fuzzing_results'])
            
        if findings['dynamic']['timeline']:
            report += "\nDynamic Analysis Summary:\n" + "-" * 40 + "\n"
            report += "\n".join(findings['dynamic']['timeline'])

    return report

def process_single_file(args):
    """Process a single file for parallel execution"""
    file_path, verbose = args
    try:
        return scan_file_content(file_path, verbose)
    except Exception as e:
        if verbose:
            print(f"Error processing {file_path}: {e}")
        return []

def parallel_file_scan(file_paths, verbose=False):
    """Process files in parallel using process pool"""
    tasks = [(f, verbose) for f in file_paths]
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as executor:
        results = list(executor.map(process_single_file, tasks))
    return [item for sublist in results if sublist for item in sublist]

def main():
    parser = argparse.ArgumentParser(description="IoT Firmware Vulnerability Analyzer")
    parser.add_argument("--server", action="store_true", help="Run in server mode")
    parser.add_argument("--port", type=int, default=5000, help="Server port (default: 5000)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Server host (default: 0.0.0.0)")
    parser.add_argument("firmware", nargs="?", help="Path to the firmware file")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("-d", "--dynamic", action="store_true", help="Perform dynamic analysis")
    parser.add_argument("-j", "--json", action="store_true", help="Export results to JSON")
    args = parser.parse_args()

    if args.server:
        print(f"Starting server on {args.host}:{args.port}")
        print("Upload endpoint: http://{}:{}/analyze".format(args.host, args.port))
        app.run(host=args.host, port=args.port)
        return

    # Continue with CLI mode if not running as server
    if not args.firmware:
        print("Error: Firmware file required in CLI mode")
        return

    extracted_dir = extract_firmware(args.firmware)
    print("\nStarting deep analysis of extracted contents...")
    
    all_files = []
    total_size = 0
    MAX_TOTAL_SIZE = 500 * 1024 * 1024  # 500MB limit
    
    print("\nCollecting files for analysis...")
    for root, _, files in os.walk(extracted_dir):
        for file in files:
            full_path = os.path.join(root, file)
            try:
                # Quick file filtering
                if os.path.splitext(file)[1].lower() in {'.jpg', '.png', '.gif', '.mp3', '.mp4'}:
                    continue
                
                size = os.path.getsize(full_path)
                if size < 64 or size > 10_000_000:  # Skip tiny/huge files
                    continue
                
                total_size += size
                if total_size > MAX_TOTAL_SIZE:
                    print("Warning: Total file size exceeds limit, some files will be skipped")
                    break
                
                all_files.append(full_path)
            except:
                continue
    
    print(f"Found {len(all_files)} files to analyze")
    
    # Process in smaller chunks
    chunk_size = 50  # Process 50 files at a time
    chunks = [all_files[i:i + chunk_size] for i in range(0, len(all_files), chunk_size)]
    
    all_vulnerabilities = []
    files_analyzed = 0
    
    try:
        # Initialize NVD data asynchronously
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        nvd_data = loop.run_until_complete(fetch_nvd_vulnerabilities())
        loop.close()
        
        print("\nAnalyzing files...")
        with tqdm(total=len(all_files), desc="Progress", ncols=100) as pbar:
            for i in range(0, len(all_files), chunk_size):
                chunk = all_files[i:i + chunk_size]
                vulns = parallel_file_scan(chunk, args.verbose)
                if vulns:
                    all_vulnerabilities.extend(vulns)
                files_analyzed += len(chunk)
                pbar.update(len(chunk))
                
                if args.verbose:
                    print(f"\nFound {len(vulns)} vulnerabilities in current chunk")
        
    except KeyboardInterrupt:
        print("\nAnalysis interrupted by user.")
    except Exception as e:
        print(f"\nError during analysis: {str(e)}")
    finally:
        if files_analyzed > 0:
            report = generate_report(all_vulnerabilities, args.json)
            if args.json:
                output_file = f"{os.path.splitext(args.firmware)[0]}_vulnerabilities.json"
                with open(output_file, 'w') as f:
                    f.write(report)
                print(f"\nResults exported to: {output_file}")
            else:
                print(report)

    if args.dynamic:
        print("\n" + "=" * 50)
        print("🔄 Starting Dynamic Analysis Phase")
        print("=" * 50)
        analyzer = DynamicAnalyzer(extracted_dir, args.verbose)
        dynamic_findings = analyzer.run_dynamic_analysis()
        all_vulnerabilities.extend([{
            "type": "Dynamic Analysis",
            "file": "emulation",
            "line": 0,
            "match": finding
        } for finding in dynamic_findings])

    print("\n" + "=" * 50)
    print(f"Analysis Complete - Examined {files_analyzed} files")
    print("=" * 50)
    print(generate_report(all_vulnerabilities))

if __name__ == "__main__":
    main()
