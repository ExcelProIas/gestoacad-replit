import os
import json
import logging
import secrets
import string
from datetime import datetime, date
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "escola-sistema-secreto-2024")

def load_json_data(filename):
    """Carrega dados de um arquivo JSON"""
    try:
        with open(f'data/{filename}', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.error(f"Arquivo {filename} não encontrado")
        return [] if filename != 'config.json' else {"ano_letivo_ativo": 2025}
    except json.JSONDecodeError:
        logging.error(f"Erro ao decodificar JSON do arquivo {filename}")
        return [] if filename != 'config.json' else {"ano_letivo_ativo": 2025}

def get_active_school_year():
    """Retorna o ano letivo ativo configurado"""
    config = load_json_data('config.json')
    return config.get('ano_letivo_ativo', 2025)

def save_json_data(filename, data):
    """Salva dados em um arquivo JSON"""
    try:
        with open(f'data/{filename}', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logging.error(f"Erro ao salvar arquivo {filename}: {e}")
        return False

def generate_temporary_password(length=12):
    """Gera uma senha aleatória e segura."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    password = ''.join(secrets.choice(alphabet) for i in range(length))
    return password

def login_required(f):
    """Decorator para rotas que requerem login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def role_required(required_roles):
    """Decorator para rotas que requerem roles específicos"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_role' not in session or session['user_role'] not in required_roles:
                flash('Acesso negado. Você não tem permissão para acessar esta página.', 'error')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def password_change_required(f):
    """Decorator que redireciona para a troca de senha se necessário."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get('requires_password_change', False):
            # Permite o acesso apenas à própria página de troca de senha e ao logout
            if request.endpoint not in ['change_password', 'logout']:
                flash('Por favor, altere sua senha antes de continuar.', 'warning')
                return redirect(url_for('change_password'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """Redireciona para login ou dashboard"""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Página de login com verificação de status."""
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        if not email or not password:
            flash('Por favor, preencha todos os campos.', 'error')
            return render_template('login.html')
        
        users = load_json_data('users.json')
        user = next((u for u in users if u['email'] == email), None)
        
        # REGRA NOVA: Verificar se o usuário existe e está ativo
        if user and user.get('status', 'ativo') == 'inativo':
            flash('Este usuário está inativo e não pode acessar o sistema.', 'error')
            return render_template('login.html')

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            session['user_email'] = user['email']
            session['user_role'] = user['role']
            # REGRA NOVA: Armazenar na sessão se precisa trocar a senha
            session['requires_password_change'] = user.get('requires_password_change', False)
            
            # REGRA NOVA: Redirecionar para troca de senha se necessário
            if session['requires_password_change']:
                flash('Por segurança, você precisa definir uma nova senha.', 'info')
                return redirect(url_for('change_password'))

            flash(f'Bem-vindo(a), {user["name"]}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Email ou senha incorretos.', 'error')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    """Logout do usuário"""
    session.clear()
    flash('Logout realizado com sucesso.', 'info')
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
@password_change_required
def dashboard():
    """Dashboard principal"""
    # Carregar dados para estatísticas
    students = load_json_data('students.json')
    incidents = load_json_data('incidents.json')
    events = load_json_data('events.json')
    reservations = load_json_data('reservations.json')
    
    # Filtrar incidentes recentes (últimos 30 dias)
    recent_incidents = []
    if incidents:
        today = datetime.now().date()
        for incident in incidents:
            incident_date = datetime.strptime(incident['date'], '%Y-%m-%d').date()
            if (today - incident_date).days <= 30:
                recent_incidents.append(incident)
    
    # Próximos eventos
    upcoming_events = []
    if events:
        today = datetime.now().date()
        for event in events:
            event_date = datetime.strptime(event['date'], '%Y-%m-%d').date()
            if event_date >= today:
                upcoming_events.append(event)
        upcoming_events.sort(key=lambda x: x['date'])
        upcoming_events = upcoming_events[:5]  # Primeiros 5
    
    stats = {
        'total_students': len(students),
        'recent_incidents': len(recent_incidents),
        'upcoming_events': len(upcoming_events),
        'total_reservations': len(reservations)
    }
    
    return render_template('dashboard.html', 
                         stats=stats, 
                         recent_incidents=recent_incidents[:5],
                         upcoming_events=upcoming_events)

@app.route('/students')
@login_required
@password_change_required
@role_required(['gestor'])
def students():
    """Gerenciamento de alunos (apenas gestores)"""
    students_data = load_json_data('students.json')
    classes_data = load_json_data('classes.json')
    
    # Filtros
    search = request.args.get('search', '')
    class_filter = request.args.get('class', '')
    
    if search:
        students_data = [s for s in students_data if search.lower() in s['name'].lower() or search.lower() in s['email'].lower()]
    
    if class_filter:
        students_data = [s for s in students_data if s['class_id'] == class_filter]
    
    return render_template('students.html', 
                         students=students_data, 
                         classes=classes_data,
                         search=search,
                         class_filter=class_filter)

@app.route('/students/add', methods=['POST'])
@login_required
@password_change_required
@role_required(['gestor'])
def add_student():
    """Adicionar novo aluno"""
    students_data = load_json_data('students.json')
    
    new_student = {
        'id': max([s['id'] for s in students_data], default=0) + 1,
        'name': request.form.get('name'),
        'email': request.form.get('email'),
        'phone': request.form.get('phone'),
        'class_id': request.form.get('class_id'),
        'enrollment_date': request.form.get('enrollment_date'),
        'status': 'ativo'
    }
    
    students_data.append(new_student)
    
    if save_json_data('students.json', students_data):
        flash('Aluno adicionado com sucesso!', 'success')
    else:
        flash('Erro ao adicionar aluno.', 'error')
    
    return redirect(url_for('students'))

@app.route('/students/edit/<int:student_id>', methods=['POST'])
@login_required
@password_change_required
@role_required(['gestor'])
def edit_student(student_id):
    """Editar aluno"""
    students_data = load_json_data('students.json')
    
    student = next((s for s in students_data if s['id'] == student_id), None)
    if student:
        student['name'] = request.form.get('name')
        student['email'] = request.form.get('email')
        student['phone'] = request.form.get('phone')
        student['class_id'] = request.form.get('class_id')
        student['status'] = request.form.get('status')
        
        if save_json_data('students.json', students_data):
            flash('Aluno atualizado com sucesso!', 'success')
        else:
            flash('Erro ao atualizar aluno.', 'error')
    else:
        flash('Aluno não encontrado.', 'error')
    
    return redirect(url_for('students'))

@app.route('/students/delete/<int:student_id>')
@login_required
@password_change_required
@role_required(['gestor'])
def delete_student(student_id):
    """Excluir aluno"""
    students_data = load_json_data('students.json')
    students_data = [s for s in students_data if s['id'] != student_id]
    
    if save_json_data('students.json', students_data):
        flash('Aluno excluído com sucesso!', 'success')
    else:
        flash('Erro ao excluir aluno.', 'error')
    
    return redirect(url_for('students'))

@app.route('/incidents')
@login_required
@password_change_required
def incidents():
    """Gerenciamento de ocorrências"""
    incidents_data = load_json_data('incidents.json')
    students_data = load_json_data('students.json')
    
    # Adicionar nome do aluno às ocorrências
    for incident in incidents_data:
        student = next((s for s in students_data if s['id'] == incident['student_id']), None)
        incident['student_name'] = student['name'] if student else 'Aluno não encontrado'
    
    # Filtros
    search = request.args.get('search', '')
    type_filter = request.args.get('type', '')
    
    if search:
        incidents_data = [i for i in incidents_data if search.lower() in i['student_name'].lower() or search.lower() in i['description'].lower()]
    
    if type_filter:
        incidents_data = [i for i in incidents_data if i['type'] == type_filter]
    
    return render_template('incidents.html', 
                         incidents=incidents_data, 
                         students=students_data,
                         search=search,
                         type_filter=type_filter)

@app.route('/incidents/add', methods=['POST'])
@login_required
@password_change_required
def add_incident():
    """Adicionar nova ocorrência"""
    incidents_data = load_json_data('incidents.json')
    
    new_incident = {
        'id': max([i['id'] for i in incidents_data], default=0) + 1,
        'student_id': int(request.form.get('student_id')),
        'type': request.form.get('type'),
        'description': request.form.get('description'),
        'date': request.form.get('date'),
        'reported_by': session['user_name'],
        'status': 'pendente'
    }
    
    incidents_data.append(new_incident)
    
    if save_json_data('incidents.json', incidents_data):
        flash('Ocorrência registrada com sucesso!', 'success')
    else:
        flash('Erro ao registrar ocorrência.', 'error')
    
    return redirect(url_for('incidents'))

@app.route('/events')
@login_required
@password_change_required
def events():
    """Gerenciamento de eventos"""
    events_data = load_json_data('events.json')
    
    # Filtros
    search = request.args.get('search', '')
    
    if search:
        events_data = [e for e in events_data if search.lower() in e['name'].lower() or search.lower() in e['description'].lower()]
    
    return render_template('events.html', events=events_data, search=search)

@app.route('/events/add', methods=['POST'])
@login_required
@password_change_required
def add_event():
    """Adicionar novo evento"""
    events_data = load_json_data('events.json')
    
    new_event = {
        'id': max([e['id'] for e in events_data], default=0) + 1,
        'name': request.form.get('name'),
        'description': request.form.get('description'),
        'date': request.form.get('date'),
        'time': request.form.get('time'),
        'location': request.form.get('location'),
        'created_by': session['user_name']
    }
    
    events_data.append(new_event)
    
    if save_json_data('events.json', events_data):
        flash('Evento criado com sucesso!', 'success')
    else:
        flash('Erro ao criar evento.', 'error')
    
    return redirect(url_for('events'))

@app.route('/reservations')
@login_required
@password_change_required
def reservations():
    """Gerenciamento de reservas"""
    reservations_data = load_json_data('reservations.json')
    rooms_data = load_json_data('rooms.json')
    
    # Adicionar nome da sala às reservas
    for reservation in reservations_data:
        room = next((r for r in rooms_data if r['id'] == reservation['room_id']), None)
        reservation['room_name'] = room['name'] if room else 'Sala não encontrada'
    
    return render_template('reservations.html', 
                         reservations=reservations_data, 
                         rooms=rooms_data)

@app.route('/reservations/add', methods=['POST'])
@login_required
@password_change_required
def add_reservation():
    """Adicionar nova reserva"""
    reservations_data = load_json_data('reservations.json')
    
    room_id = int(request.form.get('room_id'))
    date = request.form.get('date')
    start_time = request.form.get('start_time')
    end_time = request.form.get('end_time')
    
    # Verificar disponibilidade
    conflict = False
    for reservation in reservations_data:
        if (reservation['room_id'] == room_id and 
            reservation['date'] == date and
            reservation['status'] == 'confirmada'):
            # Verificar sobreposição de horários
            existing_start = reservation['start_time']
            existing_end = reservation['end_time']
            
            if not (end_time <= existing_start or start_time >= existing_end):
                conflict = True
                break
    
    if conflict:
        flash('Conflito de horário! A sala já está reservada neste período.', 'error')
    else:
        new_reservation = {
            'id': max([r['id'] for r in reservations_data], default=0) + 1,
            'room_id': room_id,
            'date': date,
            'start_time': start_time,
            'end_time': end_time,
            'purpose': request.form.get('purpose'),
            'reserved_by': session['user_name'],
            'status': 'confirmada'
        }
        
        reservations_data.append(new_reservation)
        
        if save_json_data('reservations.json', reservations_data):
            flash('Reserva criada com sucesso!', 'success')
        else:
            flash('Erro ao criar reserva.', 'error')
    
    return redirect(url_for('reservations'))

@app.route('/classes')
@login_required
@password_change_required
def classes():
    """Gerenciamento de turmas"""
    classes_data = load_json_data('classes.json')
    students_data = load_json_data('students.json')
    
    # Adicionar contagem de alunos por turma
    for class_item in classes_data:
        class_item['student_count'] = len([s for s in students_data if s['class_id'] == class_item['id']])
    
    return render_template('classes.html', classes=classes_data)

@app.route('/classes/<class_id>/students')
@login_required
@password_change_required
def class_students(class_id):
    """Listar alunos de uma turma específica"""
    students_data = load_json_data('students.json')
    classes_data = load_json_data('classes.json')
    
    class_students = [s for s in students_data if s['class_id'] == class_id]
    class_info = next((c for c in classes_data if c['id'] == class_id), None)
    
    return render_template('class_students.html', 
                         students=class_students, 
                         class_info=class_info)

@app.route('/users')
@login_required
@password_change_required
@role_required(['gestor'])
def users():
    """Gerenciamento de usuários (apenas gestores)"""
    users_data = load_json_data('users.json')
    
    # Remover senhas dos dados para exibição
    display_users = []
    for user in users_data:
        display_user = user.copy()
        display_user.pop('password_hash', None)
        display_users.append(display_user)
    
    return render_template('users.html', users=display_users)

@app.route('/users/add', methods=['POST'])
@login_required
@password_change_required
@role_required(['gestor'])
def add_user():
    """Adicionar novo usuário com senha temporária e status ativo."""
    users_data = load_json_data('users.json')
    
    email = request.form.get('email')
    
    if any(u['email'] == email for u in users_data):
        flash('Este email já está em uso.', 'error')
        return redirect(url_for('users'))
    
    # REGRA NOVA: Gerar senha temporária
    temp_password = generate_temporary_password()

    new_user = {
        'id': max([u['id'] for u in users_data], default=0) + 1,
        'name': request.form.get('name'),
        'email': email,
        'role': request.form.get('role'),
        'password_hash': generate_password_hash(temp_password),
        'status': 'ativo',  # REGRA NOVA
        'requires_password_change': True  # REGRA NOVA
    }
    
    users_data.append(new_user)
    
    if save_json_data('users.json', users_data):
        # REGRA NOVA: Informar a senha gerada para o gestor
        flash(f'Usuário criado com sucesso! A senha temporária é: {temp_password}', 'success')
    else:
        flash('Erro ao criar usuário.', 'error')
    
    return redirect(url_for('users'))

@app.route('/users/toggle_status/<int:user_id>')
@login_required
@password_change_required
@role_required(['gestor'])
def toggle_user_status(user_id):
    """Ativa ou desativa um usuário."""
    if user_id == session['user_id']:
        flash('Você não pode alterar o status do seu próprio usuário.', 'error')
        return redirect(url_for('users'))

    users_data = load_json_data('users.json')
    user = next((u for u in users_data if u['id'] == user_id), None)

    if user:
        # Inverte o status
        current_status = user.get('status', 'ativo')
        user['status'] = 'inativo' if current_status == 'ativo' else 'ativo'
        
        if save_json_data('users.json', users_data):
            flash(f'Status do usuário {user["name"]} alterado com sucesso!', 'success')
        else:
            flash('Erro ao alterar o status do usuário.', 'error')
    else:
        flash('Usuário não encontrado.', 'error')
        
    return redirect(url_for('users'))

@app.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    """Página para o usuário definir uma nova senha."""
    if request.method == 'POST':
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')

        if not new_password or new_password != confirm_password:
            flash('As senhas não conferem ou estão vazias. Tente novamente.', 'error')
            return render_template('change_password.html')

        users = load_json_data('users.json')
        user = next((u for u in users if u['id'] == session['user_id']), None)

        if user:
            user['password_hash'] = generate_password_hash(new_password)
            user['requires_password_change'] = False
            
            if save_json_data('users.json', users):
                session['requires_password_change'] = False # Atualiza a sessão
                flash('Senha alterada com sucesso!', 'success')
                return redirect(url_for('dashboard'))
            else:
                flash('Ocorreu um erro ao salvar sua nova senha.', 'error')
        else:
            flash('Usuário não encontrado.', 'error')

    return render_template('change_password.html')

@app.route('/api/calendar-events')
@login_required
@password_change_required
def calendar_events():
    """API para eventos do calendário"""
    events_data = load_json_data('events.json')
    reservations_data = load_json_data('reservations.json')
    rooms_data = load_json_data('rooms.json')
    
    calendar_events = []
    
    # Adicionar eventos
    for event in events_data:
        calendar_events.append({
            'title': event['name'],
            'start': f"{event['date']}T{event.get('time', '09:00')}",
            'color': '#007bff',
            'type': 'event'
        })
    
    # Adicionar reservas
    for reservation in reservations_data:
        if reservation['status'] == 'confirmada':
            room = next((r for r in rooms_data if r['id'] == reservation['room_id']), None)
            room_name = room['name'] if room else 'Sala'
            
            calendar_events.append({
                'title': f"Reserva: {room_name}",
                'start': f"{reservation['date']}T{reservation['start_time']}",
                'end': f"{reservation['date']}T{reservation['end_time']}",
                'color': '#28a745',
                'type': 'reservation'
            })
    
    return jsonify(calendar_events)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
