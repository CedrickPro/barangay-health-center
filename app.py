# =============================================
#  Health Center - Disease Monitor
#  app.py  (Flask Backend)
# =============================================

import json
import os
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, jsonify, request, redirect, url_for, session

app = Flask(__name__, template_folder='.', static_folder='.')
app.secret_key = "health_center_secret_2026"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ---- Health Check ----
@app.route("/health")
def health():
    return "OK - Server is Live"

# ---- JSON database file paths ----
PATIENTS_FILE     = os.path.join(BASE_DIR, "patients.json")
APPOINTMENTS_FILE = os.path.join(BASE_DIR, "appointments.json")
USERS_FILE        = os.path.join(BASE_DIR, "users.json")


# ============================================================
#  Helpers: Load & Save JSON
# ============================================================

def load_json(filepath):
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ============================================================
#  AUTH & ROUTES
# ============================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        users = load_json(USERS_FILE)
        
        user = next((u for u in users if u["username"] == username and u["password"] == password), None)
        if user:
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["role"] = user["role"]
            session["name"] = user["name"]
            return redirect(url_for("index"))
        else:
            return render_template("login.html", error="Invalid credentials")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/")
@login_required
def index():
    user = {
        "name": session.get("name", ""),
        "role": session.get("role", ""),
        "username": session.get("username", "")
    }
    return render_template("index.html", user=user)


# ============================================================
#  API - Dashboard Stats
# ============================================================

@app.route("/api/stats", methods=["GET"])
def get_stats():
    patients = load_json(PATIENTS_FILE)
    disease_counts = {}
    for p in patients:
        d = p.get("disease", "")
        disease_counts[d] = disease_counts.get(d, 0) + 1

    return jsonify({
        "total_active": len(patients),
        "by_disease":   disease_counts,
        "dengue":       disease_counts.get("Dengue",     0),
        "flu":          disease_counts.get("Flu",        0),
        "diarrhea":     disease_counts.get("Diarrhea",   0),
        "chickenpox":   disease_counts.get("Chickenpox", 0),
        "heatstroke":   disease_counts.get("Heatstroke", 0),
    })


# ============================================================
#  API - Patients
# ============================================================

@app.route("/api/patients", methods=["GET"])
def get_patients():
    patients = load_json(PATIENTS_FILE)

    disease = request.args.get("disease", "").lower()
    purok   = request.args.get("purok",   "").lower()
    search  = request.args.get("search",  "").lower()

    if disease:
        patients = [p for p in patients if p.get("disease", "").lower() == disease]
    if purok:
        patients = [p for p in patients if p.get("purok", "").lower() == purok]
    if search:
        patients = [p for p in patients
                    if search in (p.get("first_name","") + " " + p.get("last_name","")).lower()]
    return jsonify(patients)


@app.route("/api/patients", methods=["POST"])
def add_patient():
    data = request.get_json()

    for field in ["first_name", "last_name", "disease"]:
        if not data.get(field, "").strip():
            return jsonify({"error": f"Missing required field: {field}"}), 400

    patients = load_json(PATIENTS_FILE)
    next_id  = max((p["id"] for p in patients), default=0) + 1

    new_patient = {
        "id":            next_id,
        "first_name":    data["first_name"].strip(),
        "last_name":     data["last_name"].strip(),
        "age":           data.get("age", ""),
        "gender":        data.get("gender", ""),
        "disease":       data["disease"].strip(),
        "purok":         data.get("purok", ""),
        "severity":      data.get("severity", ""),
        "symptoms":      data.get("symptoms", ""),
        "phone":         data.get("phone", ""),
        "email":         data.get("email", ""),
        "address":       data.get("address", ""),
        "status":        "Under Treatment",
        "date_reported": datetime.today().strftime("%Y-%m-%d"),
    }

    patients.append(new_patient)
    save_json(PATIENTS_FILE, patients)

    return jsonify({"message": "Patient & case saved successfully!", "patient": new_patient}), 201


@app.route("/api/patients/<int:patient_id>", methods=["GET"])
def get_patient(patient_id):
    patients = load_json(PATIENTS_FILE)
    patient  = next((p for p in patients if p["id"] == patient_id), None)
    if not patient:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(patient)


@app.route("/api/patients/<int:patient_id>", methods=["PUT"])
def update_patient(patient_id):
    patients = load_json(PATIENTS_FILE)
    patient  = next((p for p in patients if p["id"] == patient_id), None)
    if not patient:
        return jsonify({"error": "Patient not found"}), 404
    patient.update(request.get_json())
    save_json(PATIENTS_FILE, patients)
    return jsonify({"message": "Patient updated successfully", "patient": patient})


@app.route("/api/patients/<int:patient_id>", methods=["DELETE"])
def delete_patient(patient_id):
    patients = load_json(PATIENTS_FILE)
    updated  = [p for p in patients if p["id"] != patient_id]
    if len(updated) == len(patients):
        return jsonify({"error": "Patient not found"}), 404
    save_json(PATIENTS_FILE, updated)
    return jsonify({"message": "Patient deleted successfully"})


# ============================================================
#  API - Disease monitoring
# ============================================================

@app.route("/api/disease/by-purok", methods=["GET"])
def disease_by_purok():
    patients   = load_json(PATIENTS_FILE)
    purok_data = {}
    for p in patients:
        pk = p.get("purok", "")
        if pk not in purok_data:
            purok_data[pk] = {"total": 0, "diseases": {}}
        purok_data[pk]["total"] += 1
        d = p.get("disease", "")
        purok_data[pk]["diseases"][d] = purok_data[pk]["diseases"].get(d, 0) + 1
    return jsonify(purok_data)


# ============================================================
#  API - Appointments
# ============================================================

@app.route("/api/appointments", methods=["GET"])
def get_appointments():
    return jsonify(load_json(APPOINTMENTS_FILE))


@app.route("/api/appointments", methods=["POST"])
def add_appointment():
    data         = request.get_json()
    appointments = load_json(APPOINTMENTS_FILE)
    next_id      = max((a["id"] for a in appointments), default=0) + 1

    new_appt = {
        "id":       next_id,
        "patient":  data.get("patient",  "").strip(),
        "date":     data.get("date",     ""),
        "time":     data.get("time",     ""),
        "type":     data.get("type",     "Check-up"),
        "doctor":   data.get("doctor",   "").strip(),
        "notes":    data.get("notes",    "").strip(),
        "status":   "Pending",
    }

    if not new_appt["patient"]:
        return jsonify({"error": "Patient name is required"}), 400

    appointments.append(new_appt)
    save_json(APPOINTMENTS_FILE, appointments)
    return jsonify({"message": "Appointment created successfully", "appointment": new_appt}), 201


@app.route("/api/appointments/<int:appt_id>", methods=["DELETE"])
def delete_appointment(appt_id):
    appointments = load_json(APPOINTMENTS_FILE)
    updated      = [a for a in appointments if a["id"] != appt_id]
    if len(updated) == len(appointments):
        return jsonify({"error": "Appointment not found"}), 404
    save_json(APPOINTMENTS_FILE, updated)
    return jsonify({"message": "Appointment deleted"})


@app.route("/api/appointments/<int:appt_id>", methods=["PUT"])
def update_appointment_status(appt_id):
    appointments = load_json(APPOINTMENTS_FILE)
    appt         = next((a for a in appointments if a["id"] == appt_id), None)
    if not appt:
        return jsonify({"error": "Appointment not found"}), 404
    appt.update(request.get_json())
    save_json(APPOINTMENTS_FILE, appointments)
    return jsonify({"message": "Appointment updated", "appointment": appt})


# ============================================================
#  Run
# ============================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5050)), debug=False)
