# AI Preparation Coach

AI Preparation Coach is a multimodal, AI-powered platform designed to help students and professionals prepare for interviews and competitive exams. It evaluates performance across text, voice, and visual behavioral metrics to provide a comprehensive "Confidence Index" and personalized improvement plans.

## Project Overview

The platform supports two primary use cases:
- **B2C**: Individual users practicing mock interviews and exams.
- **B2B**: Institutions (colleges, training centers) monitoring student progress and skill gaps.

## Key Modules

### 1. Interview Engine
This is the core logic for handling real-time interview sessions, question generation, and multimodal analysis.

### 2. Authentication
Supports OTP-based login (Phone/Email). Uses Redis for session management.

### 3. Multimodal Analysis
- **Voice**: Analyzes WPM, filler words, silence, and sentiment.
- **Visual**: Track eye contact, emotions, posture, and stress indicators.
- **Content**: Evaluates technical accuracy and STAR structure adherence using LLMs.


### INSTRUCTIONS TO GEMINI:

1. **SKILLS**: Whenever you need to perform a task, use the relevant skills from the lists mentioned in the folder "skills". For example, if you need to debug code or generate a code snippet, use the "Code Generation" skill. If you need to analyze data or create visualizations, use the "Data Analysis" skill. This skill folder is just for you and does not have any connnection with the actual codebase of the project. It is meant to help you perform tasks more efficiently and effectively.

2. **CONTEXT**: Always refer to the project documentation and codebase for context before performing any task. This will help you understand the requirements and constraints of the project, and ensure that your work is aligned with the overall goals and objectives.

3. **COMMUNICATION**: If you have any questions or need clarification on any aspect of the project, don't hesitate to ask. Clear communication is key to the success of the project, and we want to ensure that everyone is on the same page.

4. **COLLABORATION**: This project is a collaborative effort, and we encourage you to work closely with your teammates. Share your ideas, provide feedback, and support each other to achieve the best results.

5. **QUALITY**: Always strive for high-quality work. This means writing clean, maintainable code, thoroughly testing your work, and ensuring that it meets the requirements and standards of the project.

6. **terminal**: if i type "-win" in the start of prompt then I am using windows powershell as my terminal. If you need to run any commands or scripts, please provide the appropriate syntax for powershell. if do not mention then you can use linux commands and then check if they are passing or failing.

7. **Documentation**: when i tell you this exact phrase "gemini-document-project" then only strictly you have to update the documentaions of this project. This includes updating the README file, adding comments to your code, and documenting any new features or changes you make.

8. **Token Limit**: Please be mindful of the token limit when generating responses. If you need to provide a lengthy response, consider breaking it down into smaller parts or providing a summary.

9. **token Usage**: work in such a way that you optimize the token usage. Avoid unnecessary verbosity and try to be concise while still providing all the necessary information.

10. **Feedback**: If you have any feedback or suggestions for improving the project, please share them with the team. We value your input and want to create the best possible product.