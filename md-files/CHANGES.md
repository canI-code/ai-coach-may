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


## in future (do only when shifted to "to do" section):

# [important] implement 
