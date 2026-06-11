### this file contains updates that we be made in the website. so if any time any changes done in the website, update this file.

### These are updates and not bugs.
### Updates will be either mentioned in general or page wise.
### Currently we are working only for B2C student profile.
### Once the system is set for b2C student then we will move to professional and then to b2b.

## to do:
# Dashboard:
 - [x] remove "Recent Interviews" section.
 - [x] remove "Focus Areas section.
 - 
# interview:
 - [x] allow user to select only those skills which he selected during signup or profile settings.
 - [x] under difficulty selection give users two options: (a) automatic: in this system will automatically select difficulty based on users profile. and if user is performing his 1st interview session then the difficulty will be based on the exam test results. (b) custom: in this user can select difficulty manually. also keep only three level "beginner", "intermediate", "expert".

# report:
 - change name from "report" to "progress".
 - there are 3 section in progress section:
  - *overall*: 
   - progress  section: this is the complete full-calculation line graph (similar to that of dashboard) which will be generated based on all the analytics of user including interview and exam.
   - he wil be able to see month wise, year wise and week wise. there will be level indicator on the graph as user interact with it. level means beginner, intermediat, expert.
   - Technicals Skill Bars: Show overall skill out of 100% for each skill. (will include data from interview technical answers and exams).
   - Non-tech Skills bar: This will show users body posture, communication, Voice, Reasoning bars out of 100.
   - 2 Radar Charts: one of skills and   another of Non-tech skills.
   - Individual skill line graphs.

  - *interview*: it will be as "overall" tab but will contain graphs statistics of only from interview.
   - 
  - *exam*: it will be as "overall" tab but will contain graphs statistics of only from exam.

# profile:
 - [x] Implement a "Developer Activity Heatmap" component in the Profile page. *Visual Description:* Create a GitHub-style contribution calendar occupying most of the profile section width.
 *Structure:* A large rectangular grid composed of small square cells.
7 horizontal rows representing days of the week.
Around 52–53 vertical columns representing weeks in a year.
Each square represents one day.
Month names (Jan, Feb, Mar, Apr, etc.) appear across the top aligned with the calendar.
Day labels (Mon, Wed, Fri) appear on the left side.
A year selector appears on the right side with years listed vertically (e.g., 2026, 2025, 2024, 2023).
The currently selected year is highlighted.

# interview history:
 - [x] make this similar to how exam history is designed where user is able to re-take exams and there are limits, dropdown shows graphs of each retake and then each retake stats below it, etc. 
 - [x] few changes for each session banner are: 
  - [x]remove “accuracy”.
  - [x] instead of “questions” in exam history, show of how much time option is this session.
 - [x]individual re-tries:
    - [x]show the starting difficulty in each retry. for example 1st attempt user was at beginner level, then it performs the interview and its difficulty level moves to intermediate (adaptive difficulty). Then the starting of next retake interview difficulty will be intermediate (adaptive difficulty).
    - [x]show time taken for each interview and total number of question answered in the interview.
    - add an eye button to each individual re-try so that user can see the complete report of that particular retry- session.

# progress:
 - [x] in the individual skill trend graph, 
        - remove dropdown in this grapg secction.
        - combine all the graphs of all skills in one graph with skill name appearing on hover.
        -  also add seperate color for each skill and mention it color at where the dropdown is .


# b2b related:
- mentor:
  - [x] ~~even a new mentor the dashboard is showing a graph with some values instead of 0.~~ (Verified: no dummy data, chart shows flat 0 line for new mentors)
  - [x] ~~mentor should select education details like degree, subject, year etc before creating invite links~~ (Already implemented in invite modal)
  - [x] ~~mentor profile section is missing.~~ (Exists at /dashboard/mentor/profile)
  - [x] ~~mentor getting "Active on 3 devices" error.~~ (Fixed: implemented session rotation on login and session cleanup on logout)

- mentee section:
 - [ ] after user uses invite method to login then he should not get a popup after signin to create username, enter educational details etc because those details will be set by his mentor and send invite code accordingly.
 - [x] ~~for now remove the frontend for "request" method to login.~~ (Already hidden - code exists but no UI toggle visible)
 - [x] ~~the urls are redirecting to /b2c but i want the b2b to be completely separate from b2c.~~ (Fixed: dynamic portalType routing implemented)


# admin related:
- [x] ~~when admin is approving any college mentor then he should also see the live pic and documents uploaded.~~ (Implemented in both admin and superadmin pages)
- [x] ~~instead of just one button "approve institution" add approve and reject button. if rejected then admin should mention the reason that will be mailed to that mentor.~~ (Both buttons + rejection reason modal implemented)

### important changes, handel with care:
- [ ] Dashboard: The CI score is, not. The average of all the previous CI scores. Instead it is showing the current CI score, so it has to be actually the average. Of previously Ci scores. 
- [ ] Show user his longest streak and current streak in dashboard. 
- [ ] The CI score graphs are also not proper. They go on a course and then. State jumped to a particular point, creating a straight vertical line. And then again they become a. Earlier it was a smooth graph. Now there are some issues fixed them.
- [ ] Progress: Similar issues are offering in the progress section “Skill Focus Trend” graphs should be shown monthly, weekly, yearly. also the graph is not proper. there are may vertical datapoints in the graph.
- [ ] recommendation: currently user is getting recommendation session wise but i want that do be general. like it is continuously monitoring user’s performance and as per that the recommendations are generated using Ai with proper HTML formats.  now to make less usage of AI
the system will have a “re-recommend” button which when user clicks then he gets a notification that recommendation will be generated shortly and user can continue his other activity, it will run in background. this is because even if we use a slow model there will be no worries to make it fast.
- [ ] remove “full report” button in recommendation section.
- [ ] make recommendation system fully autonomous. It will be 100% AI generated. replies should be strictly proper and AI should give content such that those can be converted to html-css styled.
- [ ] to make it autonomous we will make use of threshold values. so the logic is: data will be taken from “Technical Skill Progress” and “Behavioral & Competency Skills” under “progress” section because those are the combined results of user so no need to fetch full data. 
then there will be a fixed threshold value which you can set but keep it such that if user progress variation in positive or negative is less then no need to give any ai api request but if the progress is good then api request will go. but there is one issue: user with more sessions or old user small various will 
also be similar to a new user’s bigger variation due to more number of sessions and old data. for example a user with 15 session if his any skill improve by 5% then that is almost same as a new user with 5 session having progress variation of 20% so you also need to take care of user’s profile oldness so for that you can derive some mathematical formula so that the threshold value change by taking into consideration user profile age and difference between previous and current status of each skill under technical and behavioral skills.
- [ ] if you have any doubt then do ask me before implementing the plan.