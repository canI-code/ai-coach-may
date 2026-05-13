# signup for user type: b2c student and b2c professional.
- 2 options: phone number + otp.
- if phone number + otp is selected then form filed have two areas one is country code selection and another area he enters the phone number. once phone number is subbmitted he gets an otp to enter having validity of 5 min. once otp is verified he is redirected to enter his full name and date of birth. once this is submitted he is redirected to b2c student dashboard.

security:
- after authentication user should be  not be able to access authentication pages and should be redirected to dashboard. and if he tries to access authentication pages then he should be redirected to dashboard.
- otp entering should have resend otp option and resend otp should be enabled only after 60 seconds of the previous otp sent.
- otp false tries max allowed is 5 times. after 5th incorrect attempt otp should be blocked for 15 minutes.
- there is no password entering option for user type b2c student. authentication should be done using otp only.

# signup for user type: b2b mentor:
- since mentor is associated with college, he first has to register college and himself as mentor. After the registration he gets approval from admin. once approved he can login and perform operations.

# things to enter for college registration:
- college name
- college address
- any valid document that support that college existing.
- mentor email id which will be verified by otp during registration also(which will be used for login as well as for sending otp for verification. This should be of college official id and not personal id.)
- password
- mentor aadhar card picture and live camera selfie.
- aadhar number.
- mentor phone number. which will be verified by otp during registration also.

# after approval mentor can login and perform operations.
# login for mentor:
- select college from dropdown.
- enter mentor email id and password.
- verify by otp sent to mentor registered phone number.

# security measures:
- otp should be of 6 digits and valid for 5 minutes only.
- after 3 failed attempts otp should be blocked for 15 minutes.
- after 5th failed attempt account should be blocked for 24 hours.
- forgot passowrd option should be there. if forgot password is slected mentor should enter his registered email id and phone number. then verify by otp sent to mentor registered phone number. after verification he should be able to enter new password. old password should be discarded. 
- mentor session cannot be active on more than 3 devices simultaneously.
