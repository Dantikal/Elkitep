from django.urls import path
from .views import ApplicationsView, DecisionView, ApplicationPhotoView, UnitDeputiesView, UnitUsersAdminView, QuizResultUnitsView, QuizResultUsersView, QuizUserHistoryView, CancelledReferralsView, CancelledReferralDetailView

urlpatterns = [
    path('applications/', ApplicationsView.as_view()),
    path('applications/<int:pk>/decision/', DecisionView.as_view()),
    path('applications/<int:pk>/photo/', ApplicationPhotoView.as_view()),
    path('unit-deputies/', UnitDeputiesView.as_view()),
    path('unit-users/', UnitUsersAdminView.as_view()),
    path('quiz-results/units/', QuizResultUnitsView.as_view()),
    path('quiz-results/unit/<path:unit>/<str:category>/', QuizResultUsersView.as_view()),
    path('quiz-results/user/<int:user_id>/history/', QuizUserHistoryView.as_view()),
    path('cancelled-referrals/', CancelledReferralsView.as_view()),
    path('cancelled-referrals/<int:pk>/', CancelledReferralDetailView.as_view()),
]
