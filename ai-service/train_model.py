# FILE: ai-service/train_model.py
import joblib
import pandas as pd
import os
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

# --- 1. LOAD DATA FROM CSV ---
csv_path = 'symptoms.csv'

if not os.path.exists(csv_path):
    print(f"❌ Error: '{csv_path}' not found. Please create the CSV file first.")
    exit()

print(f"📂 Loading data from {csv_path}...")
df = pd.read_csv(csv_path)

# Check if data loaded correctly
print(f"📊 Found {len(df)} training examples.")

# --- 2. BUILD THE PIPELINE ---
# We use CountVectorizer to turn words into numbers
# We use LogisticRegression to classify them
model = make_pipeline(CountVectorizer(), LogisticRegression())

# --- 3. TRAIN ---
print("🧠 Training the AI on the CSV data...")
try:
    model.fit(df['symptoms'], df['triage_category'])
    
    # --- 4. SAVE ---
    joblib.dump(model, 'model.pkl')
    print("✅ Success! Model updated. Restart your app.py to use it.")
    
except Exception as e:
    print(f"❌ Training Failed: {e}")