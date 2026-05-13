# login for user type: b2b student:
- b2b student have to enter email id and password given to them.
- incase they forget password then they can use forget password option to reset their password.
- forgot password option will send a otp to their email id and they have to enter otp to reset their password.

# signup for user type: b2b student:
- if user clicks on signup then he have to select his college id and enter his full name, email id he want mentor to register, phone number, gender and date of birth. and then submit the request to mentor to register.
- mentor will receive a notification and will have option to approve or reject the request.
- if mentor approves the request then the user will be able to login to the system. He will get an email conformation of his approval or rejection and if apporved then he will get his password through an email to create his password.

security:
- after authentication user should be  not be able to access authentication pages and should be redirected to dashboard. and if he tries to access authentication pages then he should be redirected to dashboard.
- otp entering should have resend otp option and resend otp should be enabled only after 60 seconds of the previous otp sent.
- otp false tries max allowed is 5 times. after 5th incorrect attempt otp should be blocked for 15 minutes.
- there is no password entering option for user type b2c student. authentication should be done using otp only.
- to prevent multiple logins from same account, system should maintain the last active time of the user and if the user tries to login from another device then the user should be logged out from all devices.
- mentor will have access to know how many times a student logged in, when was the last login and from which device the student logged in.
- mnetor can disable a user's account and the user will not be able to login to the system. if the mentor disables a user's account then the user should be logged out from all devices.


gemini --resume 'dd348ea6-0b00-4383-be18-238e4338268e'