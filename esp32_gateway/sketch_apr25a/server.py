import socket
import json
import datetime

# UDP server settings
UDP_IP = "0.0.0.0"  # Listen on all interfaces
UDP_PORT = 12345

# Create UDP socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((UDP_IP, UDP_PORT))

# Get server's actual IP address
def get_local_ip():
    try:
        # Create a temporary socket to connect to an external server
        temp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        temp_socket.connect(("8.8.8.8", 80))  # Google's DNS server
        ip_address = temp_socket.getsockname()[0]
        temp_socket.close()
        return ip_address
    except Exception:
        return "127.0.0.1"  # Return localhost if unable to determine

server_ip = get_local_ip()

# Log file
log_file = open("traffic_logs.txt", "a")

print(f"UDP server running on IP: {server_ip}, port: {UDP_PORT}")
print(f"UDP server listening on all interfaces (0.0.0.0:{UDP_PORT})...")

while True:
    data, addr = sock.recvfrom(1024)  # Buffer size 1024 bytes
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        # Decode JSON data
        packet = json.loads(data.decode('utf-8'))
        log_entry = f"{timestamp} - Source: {packet['source_ip']}:{packet['source_port']}, "
        log_entry += f"Dest: {packet['dest_ip']}:{packet['dest_port']}, "
        log_entry += f"Size: {packet['packet_size']} bytes, Timestamp: {packet['timestamp']}\n"
        
        # Print to console and save to file
        print(log_entry)
        log_file.write(log_entry)
        log_file.flush()  # Ensure immediate write to file
    except Exception as e:
        print(f"Error processing packet from {addr}: {e}")