"""Тесттен өткөн колдонуучулар жана жолдомолор.

Колдонуучу курстун REQUIRED_TESTS модулдук тестин аяктаган учурдан тартып курстун башчысында
DECISION_HOURS саат бар: «Жолдомо жөнөтүү» же «Жокко чыгаруу» (себеби менен).
Мөөнөт өтсө, жолдомо автоматтык түрдө жөнөтүлөт жана аны жокко чыгарууга болбойт.
"""
from datetime import timedelta
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from .courses import ApprovedUser, CoursePermission, get_course, require_manage
from .models import CourseReferral, CourseSection, QuizAttempt, ReferralSequence

# Колдонуучу курстун ушунча модулдук тестинен өткөндө тизмеге кирет.
REQUIRED_TESTS = 2
# Курстун башчысынын чечим кабыл алуусу үчүн убакыт.
DECISION_HOURS = 24


def grade(correct, total):
    return min(5, correct * 5 // total) if total else 0


def course_results(course, user=None):
    """Курстун ар бир колдонуучусу үчүн: ар бир тест боюнча акыркы аракет жана тест биринчи жолу аяктаган убакыт."""
    attempts = QuizAttempt.objects.filter(quiz__course=course).exclude(status='active').select_related('quiz', 'user').order_by('id')
    if user is not None:
        attempts = attempts.filter(user=user)
    data = {}
    for attempt in attempts:
        row = data.setdefault(attempt.user_id, {'user': attempt.user, 'latest': {}, 'first_done': {}})
        row['latest'][attempt.quiz_id] = attempt  # id боюнча иреттелген — акыркысы калат
        row['first_done'].setdefault(attempt.quiz_id, attempt.finished_at or attempt.started_at)
    return data


def summarize(row):
    tests = []
    for attempt in sorted(row['latest'].values(), key=lambda a: ((a.quiz.module or 1), a.quiz.deadline or a.finished_at, a.quiz_id)):
        total = len(attempt.snapshot)
        correct = 0 if attempt.status == 'failed' else sum(attempt.answers.get(q['id']) == q['correct_id'] for q in attempt.snapshot)
        tests.append({'quiz_id': attempt.quiz_id, 'title': attempt.quiz.title, 'module': attempt.quiz.module, 'status': attempt.status,
                      'correct_answers': correct, 'total': total, 'grade': grade(correct, total),
                      'finished_at': attempt.finished_at.isoformat() if attempt.finished_at else None})
    correct = sum(t['correct_answers'] for t in tests)
    total = sum(t['total'] for t in tests)
    return {'tests': tests, 'correct_answers': correct, 'total': total, 'grade': grade(correct, total)}


def qualified_at(row):
    """REQUIRED_TESTS-чи тест биринчи жолу аяктаган убакыт; аз болсо — None."""
    times = sorted(row['first_done'].values())
    return times[REQUIRED_TESTS - 1] if len(times) >= REQUIRED_TESTS else None


def evaluate(course, user=None):
    """Тесттен өткөндөрдү эсептейт жана мөөнөтү өткөн жолдомолорду автоматтык түрдө жөнөтөт."""
    now = timezone.now()
    referrals = {r.user_id: r for r in CourseReferral.objects.filter(course=course, **({'user': user} if user else {}))}
    rows = []
    for user_id, row in course_results(course, user).items():
        started = qualified_at(row)
        if not started:
            continue
        summary = summarize(row)
        deadline = started + timedelta(hours=DECISION_HOURS)
        referral = referrals.get(user_id)
        if referral is None and now >= deadline:
            try:
                with transaction.atomic():
                    referral = CourseReferral.objects.create(course=course, user=row['user'], status='sent', auto_sent=True,
                                                             created_at=deadline, result=summary, reg_number=ReferralSequence.next())
            except IntegrityError:
                referral = CourseReferral.objects.get(course=course, user=row['user'])
        rows.append({'user': row['user'], 'summary': summary, 'qualified_at': started, 'decision_deadline': deadline, 'referral': referral})
    return rows


def passer_data(item):
    user, referral = item['user'], item['referral']
    return {'id': user.id, 'study_number': user.study_number, 'email': user.email, 'military_unit': user.military_unit,
            **item['summary'],
            'qualified_at': item['qualified_at'].isoformat(), 'decision_deadline': item['decision_deadline'].isoformat(),
            'state': referral.status if referral else 'pending',
            'auto_sent': bool(referral and referral.auto_sent),
            'referral_sent_at': referral.created_at.isoformat() if referral and referral.status == 'sent' else None,
            'cancelled_at': referral.created_at.isoformat() if referral and referral.status == 'cancelled' else None,
            'cancel_reason': referral.cancel_reason if referral else '',
            'reg_number': referral.reg_number if referral else None}


class CoursePassers(APIView):
    permission_classes = [CoursePermission]
    def get(self, request, pk):
        course = get_course(pk)
        require_manage(request.user, course)
        rows = sorted(evaluate(course), key=lambda item: item['user'].study_number)
        return Response({'required_tests': REQUIRED_TESTS, 'decision_hours': DECISION_HOURS,
                         'server_now': timezone.now().isoformat(), 'users': [passer_data(item) for item in rows]})


def pending_item(request, pk):
    """Чечим кабыл алына турган колдонуучу; мөөнөт өтсө же чечим кабыл алынса — ката."""
    course = get_course(pk)
    require_manage(request.user, course)
    user_id = request.data.get('user_id')
    items = [item for item in evaluate(course) if item['user'].id == user_id]
    if not items:
        raise ValidationError({'user_id': f'Колдонуучу курстун {REQUIRED_TESTS} модулдук тестинен өтө элек.'})
    item = items[0]
    referral = item['referral']
    if referral is not None:
        if referral.auto_sent:
            raise ValidationError({'detail': f'{DECISION_HOURS} саат өттү: жолдомо автоматтык түрдө жөнөтүлдү, аны жокко чыгарууга болбойт.'})
        raise ValidationError({'detail': 'Бул колдонуучу боюнча чечим мурун кабыл алынган.'})
    return course, item


class SendReferral(APIView):
    permission_classes = [CoursePermission]
    def post(self, request, pk):
        course, item = pending_item(request, pk)
        try:
            with transaction.atomic():
                CourseReferral.objects.create(course=course, user=item['user'], sender=request.user, status='sent', result=item['summary'],
                                              reg_number=ReferralSequence.next())
        except IntegrityError:
            raise ValidationError({'detail': 'Бул колдонуучу боюнча чечим мурун кабыл алынган.'})
        item['referral'] = CourseReferral.objects.get(course=course, user=item['user'])
        return Response(passer_data(item), status=201)


class CancelReferral(APIView):
    permission_classes = [CoursePermission]
    def post(self, request, pk):
        reason = request.data.get('reason')
        if not isinstance(reason, str) or not reason.strip():
            raise ValidationError({'reason': 'Жокко чыгаруунун себебин жазыңыз.'})
        if len(reason) > 2000:
            raise ValidationError({'reason': 'Себеп 2000 белгиден ашпашы керек.'})
        course, item = pending_item(request, pk)
        try:
            with transaction.atomic():
                CourseReferral.objects.create(course=course, user=item['user'], sender=request.user, status='cancelled',
                                              cancel_reason=reason.strip(), result=item['summary'])
        except IntegrityError:
            raise ValidationError({'detail': 'Бул колдонуучу боюнча чечим мурун кабыл алынган.'})
        item['referral'] = CourseReferral.objects.get(course=course, user=item['user'])
        return Response(passer_data(item), status=201)


def evaluate_for_user(user):
    """Колдонуучунун курстары боюнча мөөнөтү өткөн жолдомолорду жөнөтөт (кошумча фон процесси керек эмес)."""
    for course in CourseSection.objects.filter(parent__isnull=True, quizzes__attempts__user=user).distinct():
        evaluate(course, user)


# Электрондук жолдомонун жарактуу мөөнөтү (ай) жана «ӨТТҮ» үчүн минималдуу баа.
VALID_MONTHS = 1
PASS_GRADE = 3


def add_months(moment, months):
    """Календардык ай кошуу: 31-январь + 1 ай = 28/29-февраль."""
    import calendar
    month_index = moment.month - 1 + months
    year, month = moment.year + month_index // 12, month_index % 12 + 1
    return moment.replace(year=year, month=month, day=min(moment.day, calendar.monthrange(year, month)[1]))


def referral_data(referral):
    user = referral.user
    result = referral.result or {}
    if not result.get('tests'):
        # Эски жолдомолордо жыйынтык сакталган эмес — аракеттерден эсептейбиз.
        row = course_results(referral.course, user).get(user.id)
        result = summarize(row) if row else {}
    finished = [t['finished_at'] for t in result.get('tests', []) if t.get('finished_at')]
    issued = timezone.localtime(referral.created_at)
    grade_value = result.get('grade')
    return {'id': referral.id, 'reg_number': referral.reg_number, 'course_title': referral.course.title, 'study_number': user.study_number,
            'sender': referral.sender.email if referral.sender else '', 'auto_sent': referral.auto_sent,
            'created_at': referral.created_at.isoformat(), 'is_read': referral.read_at is not None,
            # Электрондук жолдомонун талаалары
            'test_date': max(finished) if finished else None,
            'passed': grade_value is not None and grade_value >= PASS_GRADE,
            'grade': grade_value, 'correct_answers': result.get('correct_answers'), 'total': result.get('total'),
            'issued_at': issued.isoformat(), 'valid_months': VALID_MONTHS,
            'exam_deadline': add_months(issued, VALID_MONTHS).isoformat(),
            'message': f'Жолдомо. Окуу номери: {user.study_number}. Сиз «{referral.course.title}» курсунун модулдук тесттеринен өттүңүз.'}


class MyReferrals(APIView):
    permission_classes = [ApprovedUser]
    def get(self, request):
        evaluate_for_user(request.user)
        rows = (CourseReferral.objects.filter(user=request.user, status='sent', created_at__lte=timezone.now())
                .select_related('course', 'user', 'sender').order_by('-created_at', '-id'))
        return Response([referral_data(r) for r in rows])


class ReferralUnread(APIView):
    permission_classes = [ApprovedUser]
    def get(self, request):
        evaluate_for_user(request.user)
        return Response({'unread': CourseReferral.objects.filter(user=request.user, status='sent', read_at__isnull=True).count()})
    def post(self, request):
        CourseReferral.objects.filter(user=request.user, status='sent', read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=204)
