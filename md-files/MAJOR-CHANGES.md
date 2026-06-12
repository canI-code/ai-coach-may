### this file contains major changes that may break system functionality so they need to be planned properly and then after the user approves it should be implemented.

## B2B users.

- **3 types of users: Institution, mentor(s), student(s).**
    **institution:** 
        - they are the representatives of a college. they can be placement officer of a college, office administrator, accountant.
        - they will visit our website’s home page and then under pricing section they have to click “business purchase” option. On clicking they will be given a form that will ask all those details that currently “mentor” registration is asking. 
        - on fill everything, the details will go to admin panel.
        - admin will contact them either by call or email after document verification. during call or email admin will ask what type of plan they require like how many credits they need and up to what duration. example placement officer say that they need 1000 credits for 1 year time and all exam, interview and recommendation portal enabled. then admin will create that institute’s database and set these values in her institution database. after that he will mail her login credentials. 
        - now the institute person will login via those credentials in her dashboard.
        - her dashboard will have: profile, overview, manage mentors, request more credits and time, track each mentor overview.
        - she as representative of her institute will now create mentors by setting their name, email id, password (autogenerate), department, year (batch), college name will auto come. once each mentor is created she can now share their details to them via mail. for credits either she can set for each mentor and if she left it blank then mentors can request as per their requirements.
    **Mentor:**
        - mentor will login via credentials.
        - then can even change password by clicking forgot password and an otp sent to their email id. (currently keep it demo otp as 123456 as we are in development phase)..
        - then mentor(s) can sent mentee invite link and/or invite code to join under them.
        - now if mentor have credits they can send equal amount of credits to each mentee by just one button or he will also have option to set manually any credit amount to each mentee.
        - as she adds credits the overall amount of credit value will also change in frontend so that she does not give more then assigned credits in total or to individual mentee.
        - if the mentor is not assigned any credits then she can request how much credits she need as per her usage. but if she is using the request phase then she also has to mention how many students are there under her. and institute will also see how much credits she currently has.
        - institute head may grant the requested number of credits or less or more that is on her mood.
        - mentor can anytime ask more credits. 
        - mentor dashboard will have following options: overview, add mentee, manage mentee, track mentee, profile, request credits, chat.
        - she can even create batches and then distribute credits, portal limit (interview, exam, recommendation) or give access to all three. note: if institute took credits and had selected only exam then mentors will also have one option of mentor to assign to mentee, same logic for other options.
    **mentee:**
        - they will have same dashboard as that of b2c student. but out of three portals they will have access to or see only those options that are enabled by their mentor.
        - they will also have one more option called “mentor” where they can see basic details of their mentor, chat with them.
        - no one mentee can see other mentee’s details.
        - imagine mentee joined via link or code then after that to access his portals and dashboard he has to create an account by setting name, phone number, email id, password. education details will be auto fetched from what the mentor had set for his batch or him personally. 
