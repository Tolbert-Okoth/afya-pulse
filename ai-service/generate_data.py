# FILE: ai-service/generate_data.py
import pandas as pd
import random

# Define common templates to multiply our data
templates = [
    "I have {}", "suffering from {}", "patient has {}", "complains of {}", 
    "experiencing {}", "severe {}", "mild {}", "{}", "help with {}"
]

# 1. RED CATEGORY (Emergency - 150+ examples)
red_symptoms = [
    "chest pain", "heart attack", "cardiac arrest", "stroke", "unconscious", 
    "not breathing", "severe head injury", "gunshot wound", "stab wound", 
    "vomiting blood", "coughing blood", "seizure", "convulsions", "snake bite", 
    "poisoning", "drank bleach", "overdose", "severe burn", "third degree burn", 
    "crushed limb", "amputation", "severe allergic reaction", "anaphylaxis", 
    "blue lips", "choking", "drowning", "electrocution", "fall from height", 
    "suicidal thoughts", "sudden paralysis", "severe bleeding"
]

# 2. YELLOW CATEGORY (Urgent - 150+ examples)
yellow_symptoms = [
    "high fever", "migraine", "severe headache", "broken arm", "broken leg", 
    "fracture", "dislocation", "deep cut", "requiring stitches", "kidney stone", 
    "gallstones", "appendicitis", "abdominal pain", "persistent vomiting", 
    "dehydration", "asthma attack", "difficulty breathing", "blood in urine", 
    "severe flu", "malaria", "typhoid", "dengue", "dog bite", "human bite", 
    "rusty nail puncture", "severe rash", "blurred vision", "fainting", "dizziness"
]

# 3. GREEN CATEGORY (Non-Urgent - 200+ examples)
green_symptoms = [
    "runny nose", "mild cough", "sore throat", "itchy throat", "sneezing", 
    "common cold", "mild fever", "headache", "stomach ache", "indigestion", 
    "heartburn", "acid reflux", "bloating", "constipation", "diarrhea", 
    "minor cut", "scrape", "bruise", "blister", "minor burn", "sunburn", 
    "dry skin", "acne", "rash", "itchy eyes", "watery eyes", "pink eye", 
    "ear ache", "blocked ear", "toothache", "gum pain", "back pain", 
    "neck pain", "knee pain", "sprained ankle", "muscle soreness", "fatigue", 
    "tiredness", "insomnia", "trouble sleeping", "anxiety", "stress", 
    "nose bleed", "hiccups", "cramps"
]

data = []

# Generate varied sentences
def generate(symptom_list, category):
    for symptom in symptom_list:
        # Add the raw symptom
        data.append([symptom, category])
        # Add 3 random variations
        for _ in range(3):
            phrase = random.choice(templates).format(symptom)
            data.append([phrase, category])

generate(red_symptoms, "RED")
generate(yellow_symptoms, "YELLOW")
generate(green_symptoms, "GREEN")

# Save to CSV
df = pd.DataFrame(data, columns=['symptoms', 'triage_category'])
# Shuffle the data
df = df.sample(frac=1).reset_index(drop=True)

print(f"✅ Generated {len(df)} training examples.")
df.to_csv('symptoms.csv', index=False)
print("📂 Saved to symptoms.csv")