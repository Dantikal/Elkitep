from django.urls import include, path
from .views import RegisterView, LoginView, MeView, LogoutView, PhotoView, UnitUsersView
from . import courses
urlpatterns = [path("admin/", include("administration.urls")), path("register/", RegisterView.as_view()), path("login/", LoginView.as_view()), path("me/", MeView.as_view()), path("photo/", PhotoView.as_view()), path("logout/", LogoutView.as_view()), path("unit/users/", UnitUsersView.as_view())]

from .training import TopicList, TopicDetail, SubjectTopicList, SubjectTopicDetail, SubjectTopicMaterialList, MaterialList, MaterialDetail, MaterialFile, MaterialFileLink
urlpatterns += [path("training/2026/sections/<str:section>/<str:category>/months/<int:month>/topics/", TopicList.as_view()), path("training/2026/<str:category>/months/<int:month>/topics/", TopicList.as_view()), path("training/materials/<int:pk>/file-link/", MaterialFileLink.as_view()), path("training/2026/months/<int:month>/topics/", TopicList.as_view()), path("training/topics/<int:topic_id>/", TopicDetail.as_view()), path("training/topics/<int:topic_id>/materials/", MaterialList.as_view()), path("training/subjects/<int:subject_id>/topics/", SubjectTopicList.as_view()), path("training/subject-topics/<int:pk>/", SubjectTopicDetail.as_view()), path("training/subject-topics/<int:subject_topic_id>/materials/", SubjectTopicMaterialList.as_view()), path("training/materials/<int:pk>/", MaterialDetail.as_view()), path("training/materials/<int:pk>/file/", MaterialFile.as_view())]

from .quizzes import QuizList, QuizDetail, StartAttempt, AttemptAction, RecoverAttempts, MyQuizResults
urlpatterns += [
    path('courses/sections/item/<int:pk>/', courses.SectionDetail.as_view()),
    path('courses/materials/<int:pk>/', courses.MaterialDetail.as_view()),
    path('training/topics/<int:topic_id>/quizzes/', QuizList.as_view()),
    path('training/quizzes/<int:pk>/', QuizDetail.as_view()),
    path('training/quizzes/<int:pk>/start/', StartAttempt.as_view()),
    path('training/attempts/recover/', RecoverAttempts.as_view()),
    path('training/my-quiz-results/', MyQuizResults.as_view()),
    path('training/attempts/<int:pk>/', AttemptAction.as_view()),
]

from .corrections import CorrectionList
urlpatterns += [path('training/physical/corrections/', CorrectionList.as_view())]

from .personal_plan import DayList, DayDetail
urlpatterns += [
    path('training/physical/personal-plan/days/', DayList.as_view()),
    path('training/physical/personal-plan/days/<int:pk>/', DayDetail.as_view()),
]

from .diet import DietView, PatientList, PatientDetail, PatientPhoto, RepliesView, DietNotifications
urlpatterns += [path('diet/', DietView.as_view()), path('diet/patients/', PatientList.as_view()), path('diet/patients/<int:pk>/', PatientDetail.as_view()), path('diet/patients/<int:pk>/photo/', PatientPhoto.as_view()), path('diet/replies/', RepliesView.as_view()), path('diet/notifications/', DietNotifications.as_view())]

urlpatterns += [
    path('courses/sections/', courses.SectionList.as_view()),
    path('courses/sections/<int:parent_id>/children/', courses.SectionList.as_view()),
    path('courses/sections/<int:section_id>/materials/', courses.MaterialList.as_view()),
    path('courses/materials/<int:pk>/file-link/', courses.MaterialFileLink.as_view()),
    path('courses/materials/<int:pk>/file/', courses.MaterialFile.as_view()),
]

urlpatterns += [
    path('courses/my/', courses.MyCourses.as_view()),
    path('courses/sections/<int:pk>/all-materials/', courses.CourseMaterials.as_view()),
    path('courses/sections/<int:pk>/enroll/', courses.Enrollment.as_view()),
    path('courses/sections/<int:pk>/members/', courses.CourseMembers.as_view()),
    path('courses/sections/<int:pk>/quizzes/', courses.CourseQuizList.as_view()),
    path('courses/quizzes/<int:pk>/', courses.CourseQuizDetail.as_view()),
]

from .referrals import CoursePassers, SendReferral, CancelReferral, MyReferrals, ReferralUnread
urlpatterns += [
    path('courses/sections/<int:pk>/test-passers/', CoursePassers.as_view()),
    path('courses/sections/<int:pk>/referrals/', SendReferral.as_view()),
    path('courses/sections/<int:pk>/referrals/cancel/', CancelReferral.as_view()),
    path('referrals/', MyReferrals.as_view()),
    path('referrals/unread/', ReferralUnread.as_view()),
]

from .about import AboutView, AboutPhotoView
urlpatterns += [path('about/', AboutView.as_view()), path('about/photos/<int:pk>/', AboutPhotoView.as_view())]

from .achievements import AchievementList, AchievementDetail, AchievementFileView, AchievementFileLink, AchievementSignedFile
urlpatterns += [
    path('achievements/', AchievementList.as_view()),
    path('achievements/<int:pk>/', AchievementDetail.as_view()),
    path('achievements/files/<int:pk>/', AchievementFileView.as_view()),
    path('achievements/files/<int:pk>/link/', AchievementFileLink.as_view()),
    path('achievements/files/<int:pk>/signed/', AchievementSignedFile.as_view()),
]
