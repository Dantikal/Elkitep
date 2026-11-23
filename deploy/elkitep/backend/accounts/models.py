from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает одобрения"
        APPROVED = "approved", "Одобрено"
        REJECTED = "rejected", "Отклонено"
    role = models.CharField(max_length=20, choices=[("user", "Колдонуучу"), ("doctor", "Дарыгер"), ("deputy", "Күжүрмөн даярдоо боюнча орун басары"), ("course_head", "Курстун башчысы")], default="user")
    training_category = models.CharField(max_length=30, choices=[('officers', 'Офицерлер'), ('warrant-sergeants', 'Прапорщиктер жана сержанттар')], default='officers')
    email = models.EmailField(unique=True)
    study_number = models.CharField("Окуу номери", max_length=50, unique=True)
    military_unit = models.CharField("Аскер бөлүк", max_length=150)
    photo = models.ImageField("Сүрөт", upload_to="profiles/%Y/%m/", blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "study_number"]

class TrainingTopic(models.Model):
    section = models.CharField(max_length=20, choices=[('command', 'Командирдик даярдоо'), ('independent', 'Өз алдынча даярдануу')], default='command')
    category = models.CharField(max_length=30, choices=[('officers', 'Офицерлер'), ('warrant-sergeants', 'Прапорщиктер жана сержанттар')], default='officers')
    month = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=250)

class TrainingSubjectTopic(models.Model):
    subject = models.ForeignKey(TrainingTopic, on_delete=models.CASCADE, related_name='subject_topics')
    title = models.CharField(max_length=250)

class TrainingMaterial(models.Model):
    topic = models.ForeignKey(TrainingTopic, on_delete=models.CASCADE, related_name='materials')
    subject_topic = models.ForeignKey(TrainingSubjectTopic, null=True, blank=True, on_delete=models.CASCADE, related_name='materials')
    text = models.TextField(blank=True)
    links = models.JSONField(default=list, blank=True)
    file = models.FileField(upload_to='training/2026/%Y/%m/', blank=True)

class TrainingQuiz(models.Model):
    topic = models.ForeignKey(TrainingTopic, null=True, blank=True, on_delete=models.PROTECT, related_name='quizzes')
    course = models.ForeignKey('CourseSection', null=True, blank=True, on_delete=models.PROTECT, related_name='quizzes')
    section = models.CharField(max_length=20, choices=TrainingTopic._meta.get_field('section').choices, blank=True, default='')
    category = models.CharField(max_length=30, choices=TrainingTopic._meta.get_field('category').choices, blank=True, default='')
    month = models.PositiveSmallIntegerField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    module = models.PositiveSmallIntegerField(null=True, blank=True, choices=[(1, '1 модуль'), (2, '2 модуль')])
    title = models.CharField(max_length=250)
    duration_seconds = models.PositiveIntegerField()
    questions = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

class QuizAttempt(models.Model):
    quiz = models.ForeignKey(TrainingQuiz, on_delete=models.PROTECT, related_name='attempts')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='quiz_attempts')
    snapshot = models.JSONField()
    answers = models.JSONField(default=dict)
    started_at = models.DateTimeField()
    deadline = models.DateTimeField()
    last_seen = models.DateTimeField()
    finished_at = models.DateTimeField(null=True)
    status = models.CharField(max_length=20, default='active')
    reason = models.CharField(max_length=30, blank=True)
    percentage = models.FloatField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user'], condition=models.Q(status='active'), name='one_active_quiz_per_user')]

class PhysicalCorrection(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='physical_corrections')
    age = models.PositiveSmallIntegerField()
    altitude = models.PositiveIntegerField()
    sportswear = models.BooleanField(default=False)
    clothing_number = models.PositiveSmallIntegerField(null=True, blank=True)
    equipment = models.BooleanField()
    exercise_number = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

class PersonalTrainingDay(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='personal_training_days')
    number = models.PositiveIntegerField()
    activities = models.JSONField(default=list)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'number'], name='unique_personal_training_day')]

class DietProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='diet_profile')
    data = models.JSONField(default=dict)

class DietSubmission(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='diet_submissions')
    military_unit = models.CharField(max_length=150)
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True)

class DoctorReply(models.Model):
    submission = models.ForeignKey(DietSubmission, on_delete=models.CASCADE, related_name='replies')
    doctor = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True)

class CourseSection(models.Model):
    title = models.CharField(max_length=250)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    owner = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='owned_courses')

class CourseEnrollment(models.Model):
    course = models.ForeignKey(CourseSection, on_delete=models.CASCADE, related_name='enrollments')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='course_enrollments')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['course', 'user'], name='unique_course_enrollment')]

class CourseMaterial(models.Model):
    section = models.ForeignKey(CourseSection, on_delete=models.CASCADE, related_name='materials')
    text = models.TextField(blank=True)
    links = models.JSONField(default=list, blank=True)
    file = models.FileField(upload_to='courses/%Y/%m/', blank=True)

class CourseReferral(models.Model):
    """Жолдомо: курстун башчысы модулдук тесттерден өткөн колдонуучуга жөнөтөт."""
    course = models.ForeignKey(CourseSection, on_delete=models.CASCADE, related_name='referrals')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='course_referrals')
    sender = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='sent_referrals')
    # sent — жөнөтүлдү (колдонуучу көрөт); cancelled — курстун башчысы жокко чыгарды (администратор көрөт).
    status = models.CharField(max_length=20, default='sent', choices=[('sent', 'Жөнөтүлдү'), ('cancelled', 'Жокко чыгарылды')])
    auto_sent = models.BooleanField(default=False)
    cancel_reason = models.TextField(blank=True)
    result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)
    admin_read_at = models.DateTimeField(null=True, blank=True)
    # Администратор өз бөлүмүнөн өчүрдү; жокко чыгаруу күчүндө калат (автоматтык жөнөтүлбөйт).
    admin_deleted = models.BooleanField(default=False)
    # Каттоо номери: жөнөтүлгөн жолдомолор үчүн 1, 2, 3… эч качан кайталанбайт.
    reg_number = models.PositiveIntegerField(null=True, blank=True, unique=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['course', 'user'], name='unique_course_referral')]


class ReferralSequence(models.Model):
    """Жолдомолордун каттоо номерлеринин эсептегичи (бир гана жазуу). Номер кайра колдонулбайт."""
    last = models.PositiveIntegerField(default=0)

    @classmethod
    def next(cls):
        """transaction.atomic ичинде чакырылат."""
        seq, _ = cls.objects.select_for_update().get_or_create(pk=1)
        seq.last += 1
        seq.save(update_fields=['last'])
        return seq.last


class AboutApp(models.Model):
    """«Тиркеме жөнүндө» бөлүмү (бир гана жазуу, Django админкадан толтурулат)."""
    title = models.CharField("Долбоордун аталышы", max_length=250, default="КУТ БИЛИМ 1.0")
    team_title = models.CharField("Топтун аталышы", max_length=300, default="Күжүрмөн даярдоону санариптештирүү боюнча долбоордук топтун курамы")

    class Meta:
        verbose_name = "Тиркеме жөнүндө"
        verbose_name_plural = "Тиркеме жөнүндө"

    def __str__(self):
        return self.title

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class AboutTeamPhoto(models.Model):
    """Долбоордук топтун мүчөсү."""
    about = models.ForeignKey(AboutApp, on_delete=models.CASCADE, related_name="members")
    role = models.CharField("Ролу (мис.: ИШТЕП ЧЫГУУ ТОБУНУН ЖЕТЕКЧИСИ)", max_length=250, blank=True)
    full_name = models.CharField("Наамы жана аты-жөнү (мис.: майор Акматов Б.А.)", max_length=250, blank=True)
    position = models.CharField("Кызматы (мис.: Күжүрмөн даярдоо башкармалыгынын улук офицери)", max_length=300, blank=True)
    image = models.ImageField("Сүрөт", upload_to="about/", blank=True)
    order = models.PositiveSmallIntegerField("Тартиби", default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Топтун мүчөсү"
        verbose_name_plural = "Топтун курамы (3)"

    def __str__(self):
        return self.full_name or self.role or f"#{self.pk}"


class Achievement(models.Model):
    """«Менин жетишкендиктерим»: колдонуучу өз жетишкендигин текст, сүрөт жана PDF түрүндө жүктөйт."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']


class AchievementFile(models.Model):
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='files')
    file = models.FileField(upload_to='achievements/%Y/%m/')
    kind = models.CharField(max_length=10, choices=[('image', 'Сүрөт'), ('pdf', 'PDF')])
    name = models.CharField(max_length=255, blank=True)
