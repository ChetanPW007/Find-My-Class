import wave
import struct
import math
import os

def generate_chime():
    sample_rate = 22050
    duration = 0.8  # seconds
    num_samples = int(sample_rate * duration)
    
    data = []
    for i in range(num_samples):
        t = i / sample_rate
        
        # Tone 1 (A5 - 880Hz)
        val1 = 0.0
        if t < 0.4:
            fade1 = math.exp(-10 * t)
            val1 = 0.4 * math.sin(2 * math.pi * 880 * t) * fade1
            
        # Tone 2 (E6 - 1318.51Hz) starting at 0.1s
        val2 = 0.0
        if t >= 0.1:
            t2 = t - 0.1
            fade2 = math.exp(-8 * t2)
            val2 = 0.4 * math.sin(2 * math.pi * 1318.51 * t2) * fade2
            
        mixed = val1 + val2
        mixed = max(-1.0, min(1.0, mixed))
        
        # 16-bit PCM integer conversion
        sample = int(mixed * 32767)
        data.append(struct.pack('<h', sample))
        
    out_dir = r"e:\tmp\Find My Class\frontend\public"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "notification.wav")
    
    with wave.open(out_path, 'wb') as f:
        f.setnchannels(1)  # Mono
        f.setsampwidth(2)  # 16-bit
        f.setframerate(sample_rate)
        f.writeframes(b''.join(data))
    print(f"Generated chime audio file at: {out_path}")

if __name__ == "__main__":
    generate_chime()
