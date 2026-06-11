import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDbForUser } from '@/lib/db-selector';
import { getInterviewDb, INTERVIEW_COLLECTIONS } from '@/lib/interview/session-store';
import { computeDashboardMetrics } from '@/lib/interview/dashboard-metrics';
import { getLLMGateway } from '@/lib/interview/llm-gateway';
import type { Db } from 'mongodb';

const REAL_LEARNING_RESOURCES: Record<string, Array<{ type: string; title: string; url: string }>> = {
  "Algorithms": [
    { type: "Free Course", title: "Princeton University: Algorithms, Part I (Coursera)", url: "https://www.coursera.org/learn/algorithms-part1" },
    { type: "Free Course", title: "Stanford University: Algorithms Specialization (Coursera)", url: "https://www.coursera.org/specializations/algorithms" },
    { type: "Free Course", title: "MIT OpenCourseWare: Introduction to Algorithms", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    { type: "Free Course", title: "Harvard University: CS50's Introduction (edX)", url: "https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science" },
    { type: "Paid Course", title: "Udemy: Master the Coding Interview (Andrei Neagoie)", url: "https://www.udemy.com/course/master-the-coding-interview-data-structures-algorithms/" },
    { type: "Paid Course", title: "Udemy: Data Structures & Algorithms in Java (Abdul Bari)", url: "https://www.udemy.com/course/datastructures-algorithms-in-c/" },
    { type: "Paid Course", title: "Udemy: Data Structures & Algorithms Deep Dive", url: "https://www.udemy.com/course/data-structures-and-algorithms-deep-dive-using-java/" },
    { type: "Paid Course", title: "Educative.io: Ace the Java Coding Interview", url: "https://www.educative.io/courses/ace-java-coding-interview" },
    { type: "YouTube Video", title: "freeCodeCamp: Algorithms & Data Structures Tutorial", url: "https://www.youtube.com/watch?v=8hly31xKjhc" },
    { type: "YouTube Video", title: "freeCodeCamp: Data Structures Easy to Advanced Course", url: "https://www.youtube.com/watch?v=RBSGKlAvoiM" },
    { type: "YouTube Video", title: "Abdul Bari: Algorithms Playlist", url: "https://www.youtube.com/playlist?list=PLDN4rrl48XKpZg5WODp6yiR2Cuaa2DFFt" },
    { type: "YouTube Video", title: "NeetCode: Algorithms & Data Structures Beginner Guide", url: "https://www.youtube.com/watch?v=UgbNnN4f454" }
  ],
  "Data Structures": [
    { type: "Free Course", title: "Princeton University: Algorithms, Part I (Coursera)", url: "https://www.coursera.org/learn/algorithms-part1" },
    { type: "Free Course", title: "UC San Diego: Data Structures (Coursera)", url: "https://www.coursera.org/learn/data-structures" },
    { type: "Free Course", title: "Great Learning: Data Structures in C (Free)", url: "https://www.mygreatlearning.com/academy/learn-for-free/courses/data-structures-in-c" },
    { type: "Free Course", title: "GeeksforGeeks: Data Structures Track", url: "https://www.geeksforgeeks.org/data-structures/" },
    { type: "Paid Course", title: "Udemy: Master the Coding Interview (Andrei Neagoie)", url: "https://www.udemy.com/course/master-the-coding-interview-data-structures-algorithms/" },
    { type: "Paid Course", title: "Udemy: Data Structures & Algorithms in C/C++ (Abdul Bari)", url: "https://www.udemy.com/course/datastructures-algorithms-in-c/" },
    { type: "Paid Course", title: "Udemy: Data Structures & Algorithms in Python (Elshad Karimov)", url: "https://www.udemy.com/course/data-structures-and-algorithms-in-python/" },
    { type: "Paid Course", title: "Educative.io: Data Structures in Java - Interview Refresher", url: "https://www.educative.io/courses/data-structures-in-java-an-interview-refresher" },
    { type: "YouTube Video", title: "freeCodeCamp: Algorithms & Data Structures Tutorial", url: "https://www.youtube.com/watch?v=8hly31xKjhc" },
    { type: "YouTube Video", title: "freeCodeCamp: Data Structures Easy to Advanced Course", url: "https://www.youtube.com/watch?v=RBSGKlAvoiM" },
    { type: "YouTube Video", title: "MyCodeSchool: Data Structures Playlist", url: "https://www.youtube.com/playlist?list=PL2_aWCzGMAwI3W_yfNzCO55gDc5yAab7g" },
    { type: "YouTube Video", title: "NeetCode: DSA Roadmap & Practice", url: "https://www.youtube.com/watch?v=f54W5hFRG10" }
  ],
  "Algorithms & Data Structures": [
    { type: "Free Course", title: "Princeton University: Algorithms, Part I (Coursera)", url: "https://www.coursera.org/learn/algorithms-part1" },
    { type: "Free Course", title: "Stanford University: Algorithms Specialization (Coursera)", url: "https://www.coursera.org/specializations/algorithms" },
    { type: "Free Course", title: "MIT OpenCourseWare: Introduction to Algorithms", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/" },
    { type: "Free Course", title: "Harvard University: CS50's Introduction (edX)", url: "https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science" },
    { type: "Paid Course", title: "Udemy: Master the Coding Interview (Andrei Neagoie)", url: "https://www.udemy.com/course/master-the-coding-interview-data-structures-algorithms/" },
    { type: "Paid Course", title: "Udemy: Data Structures & Algorithms in Java (Abdul Bari)", url: "https://www.udemy.com/course/datastructures-algorithms-in-c/" },
    { type: "Paid Course", title: "Udemy: Data Structures & Algorithms Deep Dive", url: "https://www.udemy.com/course/data-structures-and-algorithms-deep-dive-using-java/" },
    { type: "Paid Course", title: "Educative.io: Ace the Java Coding Interview", url: "https://www.educative.io/courses/ace-java-coding-interview" },
    { type: "YouTube Video", title: "freeCodeCamp: Algorithms & Data Structures Tutorial", url: "https://www.youtube.com/watch?v=8hly31xKjhc" },
    { type: "YouTube Video", title: "freeCodeCamp: Data Structures Easy to Advanced Course", url: "https://www.youtube.com/watch?v=RBSGKlAvoiM" },
    { type: "YouTube Video", title: "Abdul Bari: Algorithms Playlist", url: "https://www.youtube.com/playlist?list=PLDN4rrl48XKpZg5WODp6yiR2Cuaa2DFFt" },
    { type: "YouTube Video", title: "NeetCode: Algorithms & Data Structures Beginner Guide", url: "https://www.youtube.com/watch?v=UgbNnN4f454" }
  ],
  "Operating Systems": [
    { type: "Free Course", title: "Coursera: Introduction to Operating Systems (Georgia Tech)", url: "https://www.coursera.org/learn/operating-systems" },
    { type: "Free Course", title: "edX: Operating Systems (Tsinghua)", url: "https://www.edx.org/learn/operating-systems/tsinghua-university-operating-systems" },
    { type: "Free Course", title: "MIT OpenCourseWare: Operating System Design", url: "https://ocw.mit.edu/courses/6-828-operating-system-engineering-fall-2012/" },
    { type: "Free Course", title: "UC Berkeley: CS162 Operating Systems", url: "https://inst.eecs.berkeley.edu/~cs162/" },
    { type: "Paid Course", title: "Udemy: Operating Systems from Scratch (Part 1)", url: "https://www.udemy.com/course/operating-systems-from-scratch-part1/" },
    { type: "Paid Course", title: "Udemy: Operating System Concepts", url: "https://www.udemy.com/course/operating-system-concepts/" },
    { type: "Paid Course", title: "Pluralsight: Operating Systems Fundamentals", url: "https://www.pluralsight.com/courses/operating-systems-fundamentals" },
    { type: "Paid Course", title: "Educative.io: Operating Systems - Internal Architecture", url: "https://www.educative.io/courses/operating-systems-internal-architecture" },
    { type: "YouTube Video", title: "Neso Academy: Operating Systems Playlist", url: "https://www.youtube.com/playlist?list=PLBlnK6fEyqRiVhbXDGLXDk_OQAeuVcp2O" },
    { type: "YouTube Video", title: "Gate Smashers: Operating System Playlist", url: "https://www.youtube.com/playlist?list=PLmXKhU9mM_rdKev9cQuw3gqS8OswT72K1" },
    { type: "YouTube Video", title: "freeCodeCamp: Operating System Course", url: "https://www.youtube.com/watch?v=26QPDBe-qKw" },
    { type: "YouTube Video", title: "Knowledge Gate: Operating System for GATE", url: "https://www.youtube.com/playlist?list=PLG9aCp4uE-s0r_7Y9z2h-o_p_b8XgV_X7" }
  ],
  "Database Management": [
    { type: "Free Course", title: "Coursera: Databases for Data Science (IBM)", url: "https://www.coursera.org/learn/sql-for-data-science" },
    { type: "Free Course", title: "Stanford: Databases Specialization", url: "https://www.coursera.org/specializations/databases" },
    { type: "Free Course", title: "Carnegie Mellon: Database Systems", url: "https://15445.courses.cs.cmu.edu/" },
    { type: "Free Course", title: "edX: Introduction to Databases (W3C)", url: "https://www.edx.org/learn/databases/w3cx-introduction-to-databases" },
    { type: "Paid Course", title: "Udemy: Ultimate SQL Bootcamp (Jose Portilla)", url: "https://www.udemy.com/course/the-complete-sql-bootcamp/" },
    { type: "Paid Course", title: "Udemy: Database Design Course", url: "https://www.udemy.com/course/database-design/" },
    { type: "Paid Course", title: "Pluralsight: Database Administration Fundamentals", url: "https://www.pluralsight.com/courses/database-administration-fundamentals" },
    { type: "Paid Course", title: "Educative.io: Grokking the SQL Interview", url: "https://www.educative.io/courses/grokking-the-sql-interview" },
    { type: "YouTube Video", title: "freeCodeCamp: Database Design Course", url: "https://www.youtube.com/watch?v=ztHopE5WcdA" },
    { type: "YouTube Video", title: "Programming with Mosh: SQL Tutorial", url: "https://www.youtube.com/watch?v=7S_tz1z_5bA" },
    { type: "YouTube Video", title: "Kudvenkat: SQL Server Tutorials", url: "https://www.youtube.com/playlist?list=PL08903FB7ACA1C2FB" },
    { type: "YouTube Video", title: "Neso Academy: DBMS Tutorials", url: "https://www.youtube.com/playlist?list=PLBlnK6fEyqRggqB0hE3B8K6cpxj5h_55T" }
  ],
  "Cloud Computing": [
    { type: "Free Course", title: "Coursera: AWS Cloud Technical Essentials", url: "https://www.coursera.org/learn/aws-cloud-technical-essentials" },
    { type: "Free Course", title: "Coursera: Google Cloud Computing Foundations", url: "https://www.coursera.org/specializations/gcp-cloud-computing-foundations" },
    { type: "Free Course", title: "edX: Introduction to Cloud Computing (IBM)", url: "https://www.edx.org/learn/cloud-computing/ibm-introduction-to-cloud-computing" },
    { type: "Free Course", title: "freeCodeCamp: AWS Cloud Practitioner Certification Course", url: "https://www.youtube.com/watch?v=SOTamWGuqXs" },
    { type: "Paid Course", title: "Udemy: Ultimate AWS Certified Cloud Practitioner (Stephane Maarek)", url: "https://www.udemy.com/course/aws-certified-cloud-practitioner-new/" },
    { type: "Paid Course", title: "Udemy: Ultimate AWS Certified Solutions Architect Associate", url: "https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/" },
    { type: "Paid Course", title: "Whizlabs: AWS Certified Cloud Practitioner Course", url: "https://www.whizlabs.com/aws-certified-cloud-practitioner/" },
    { type: "Paid Course", title: "Pluralsight: Cloud Computing Fundamentals", url: "https://www.pluralsight.com/courses/cloud-computing-fundamentals" },
    { type: "YouTube Video", title: "ExamPro: AWS Certified Cloud Practitioner Course", url: "https://www.youtube.com/playlist?list=PLhfrWIlLOoKPc2RecYiCZJ16505581_u_" },
    { type: "YouTube Video", title: "freeCodeCamp: Google Cloud Associate Cloud Engineer Course", url: "https://www.youtube.com/watch?v=jpNs8-3AMX8" },
    { type: "YouTube Video", title: "TechWorld with Nana: Cloud Computing for Beginners", url: "https://www.youtube.com/watch?v=EN4fPBElYLI" },
    { type: "YouTube Video", title: "freeCodeCamp: AWS Solutions Architect", url: "https://www.youtube.com/watch?v=Ia-UEYYR44s" }
  ],
  "System Design": [
    { type: "Free Course", title: "freeCodeCamp: System Design Course for Beginners", url: "https://www.youtube.com/watch?v=m8IgbRe528g" },
    { type: "Free Course", title: "GitHub: System Design Primer (Donne Martin)", url: "https://github.com/donnemartin/system-design-primer" },
    { type: "Free Course", title: "Coursera: Software Design and Architecture", url: "https://www.coursera.org/specializations/software-design-architecture" },
    { type: "Free Course", title: "edX: Software Architecture & Design (Georgia Tech)", url: "https://www.edx.org/learn/software-architecture/georgia-institute-of-technology-software-architecture-design" },
    { type: "Paid Course", title: "Udemy: Pragmatic System Design by ByteByteGo", url: "https://www.udemy.com/course/pragmatic-system-design/" },
    { type: "Paid Course", title: "Udemy: System Design Interview Guide (Sandeep Kaul)", url: "https://www.udemy.com/course/system-design-interview-prep/" },
    { type: "Paid Course", title: "Educative.io: Grokking the System Design Interview", url: "https://www.educative.io/courses/grokking-modern-system-design-interview-for-engineers-managers" },
    { type: "Paid Course", title: "InterviewReady: System Design Course by Gaurav Sen", url: "https://interviewready.io/" },
    { type: "YouTube Video", title: "ByteByteGo: System Design Interview Channel", url: "https://www.youtube.com/@ByteByteGo" },
    { type: "YouTube Video", title: "Gaurav Sen: System Design Playlist", url: "https://www.youtube.com/playlist?list=PLMCXHnjXnTnvo6alSjVkgxV-VH6EPy92c" },
    { type: "YouTube Video", title: "freeCodeCamp: System Design Fundamentals", url: "https://www.youtube.com/watch?v=SqcXyztPa1o" },
    { type: "YouTube Video", title: "ByteByteGo: System Design Basics", url: "https://www.youtube.com/watch?v=i53Gi_K397I" }
  ],
  "VLSI": [
    { type: "Free Course", title: "Coursera: MOS Transistors by Columbia University", url: "https://www.coursera.org/learn/mos-transistors" },
    { type: "Free Course", title: "Coursera: VLSI CAD Part I: Logic by Illinois", url: "https://www.coursera.org/learn/vlsi-cad" },
    { type: "Free Course", title: "edX: VLSI Fundamentals (Peking University)", url: "https://www.edx.org/learn/vlsi/peking-university-vlsi-fundamentals" },
    { type: "Free Course", title: "NPTEL: Digital VLSI Testing (Free course)", url: "https://onlinecourses.nptel.ac.in/noc20_ee76/preview" },
    { type: "Paid Course", title: "Udemy: VLSI Academy - Physical Design Flow", url: "https://www.udemy.com/course/vlsi-academy-physical-design-flow/" },
    { type: "Paid Course", title: "Udemy: ASIC Physical Design (Placement & Routing)", url: "https://www.udemy.com/course/vlsi-physical-design-flow/" },
    { type: "Paid Course", title: "Udemy: CMOS Analog VLSI Design", url: "https://www.udemy.com/course/cmos-analog-vlsi-design/" },
    { type: "Paid Course", title: "Pluralsight: Introduction to VLSI Design", url: "https://www.pluralsight.com/courses/introduction-vlsi" },
    { type: "YouTube Video", title: "NPTEL: VLSI Design Playlist", url: "https://www.youtube.com/playlist?list=PLbRMhDVUMngfdzI4A6u4Gv8W69kK7k1r8" },
    { type: "YouTube Video", title: "NPTEL: CMOS VLSI Design Playlist", url: "https://www.youtube.com/playlist?list=PL3pGy4HtqwD0M9h5h7a6P85p6WigD9B6y" },
    { type: "YouTube Video", title: "VLSI Academy: Physical Design Lectures", url: "https://www.youtube.com/playlist?list=PLXoG3a5uy1HFl2r88H7W32l3J9z8eY8S9" },
    { type: "YouTube Video", title: "Tech Legend: VLSI Tutorials", url: "https://www.youtube.com/playlist?list=PLR5G9kK15_t0zW3Zc3g9VfBwE4q4uV_k2" }
  ],
  "VLSI Design": [
    { type: "Free Course", title: "Coursera: MOS Transistors by Columbia University", url: "https://www.coursera.org/learn/mos-transistors" },
    { type: "Free Course", title: "Coursera: VLSI CAD Part I: Logic by Illinois", url: "https://www.coursera.org/learn/vlsi-cad" },
    { type: "Free Course", title: "edX: VLSI Fundamentals (Peking University)", url: "https://www.edx.org/learn/vlsi/peking-university-vlsi-fundamentals" },
    { type: "Free Course", title: "NPTEL: Digital VLSI Testing (Free course)", url: "https://onlinecourses.nptel.ac.in/noc20_ee76/preview" },
    { type: "Paid Course", title: "Udemy: VLSI Academy - Physical Design Flow", url: "https://www.udemy.com/course/vlsi-academy-physical-design-flow/" },
    { type: "Paid Course", title: "Udemy: ASIC Physical Design (Placement & Routing)", url: "https://www.udemy.com/course/vlsi-physical-design-flow/" },
    { type: "Paid Course", title: "Udemy: CMOS Analog VLSI Design", url: "https://www.udemy.com/course/cmos-analog-vlsi-design/" },
    { type: "Paid Course", title: "Pluralsight: Introduction to VLSI Design", url: "https://www.pluralsight.com/courses/introduction-vlsi" },
    { type: "YouTube Video", title: "NPTEL: VLSI Design Playlist", url: "https://www.youtube.com/playlist?list=PLbRMhDVUMngfdzI4A6u4Gv8W69kK7k1r8" },
    { type: "YouTube Video", title: "NPTEL: CMOS VLSI Design Playlist", url: "https://www.youtube.com/playlist?list=PL3pGy4HtqwD0M9h5h7a6P85p6WigD9B6y" },
    { type: "YouTube Video", title: "VLSI Academy: Physical Design Lectures", url: "https://www.youtube.com/playlist?list=PLXoG3a5uy1HFl2r88H7W32l3J9z8eY8S9" },
    { type: "YouTube Video", title: "Tech Legend: VLSI Tutorials", url: "https://www.youtube.com/playlist?list=PLR5G9kK15_t0zW3Zc3g9VfBwE4q4uV_k2" }
  ],
  "Embedded Systems": [
    { type: "Free Course", title: "edX: Embedded Systems - Shape the World by UT Austin", url: "https://www.edx.org/course/embedded-systems-shape-the-world-microcontroller" },
    { type: "Free Course", title: "Coursera: Introduction to Embedded Systems Specialization", url: "https://www.coursera.org/specializations/embedded-systems" },
    { type: "Free Course", title: "edX: Real-Time Bluetooth Networks (UT Austin)", url: "https://www.edx.org/course/real-time-bluetooth-networks-shape-the-world" },
    { type: "Free Course", title: "MIT OpenCourseWare: Introduction to Embedded Systems", url: "https://ocw.mit.edu/courses/6-115-microcomputer-project-laboratory-spring-2013/" },
    { type: "Paid Course", title: "Udemy: Mastering Microcontroller with Embedded Driver Development", url: "https://www.udemy.com/course/mastering-microcontroller-with-embedded-driver-development/" },
    { type: "Paid Course", title: "Udemy: Embedded Systems Programming on ARM Cortex-M", url: "https://www.udemy.com/course/embedded-system-programming-on-arm-cortex-m3m4/" },
    { type: "Paid Course", title: "Udemy: FreeRTOS Programming on ARM Cortex-M", url: "https://www.udemy.com/course/freertos-programming-on-arm-cortex-m3m4/" },
    { type: "Paid Course", title: "Pluralsight: Embedded Systems Development", url: "https://www.pluralsight.com/courses/embedded-systems-development" },
    { type: "YouTube Video", title: "Bharat Acharya Education: Embedded Systems Channel", url: "https://www.youtube.com/@BharatAcharyaEducation" },
    { type: "YouTube Video", title: "Fastbit Embedded Brain Academy: STM32 Microcontroller", url: "https://www.youtube.com/@FastbitEmbeddedBrainAcademy" },
    { type: "YouTube Video", title: "freeCodeCamp: Arduino Programming", url: "https://www.youtube.com/watch?v=zJ-LqeX_yLU" },
    { type: "YouTube Video", title: "Edureka: Embedded Systems Tutorial", url: "https://www.youtube.com/watch?v=mHn412VvHec" }
  ],
  "Computer Networks": [
    { type: "Free Course", title: "Coursera: Computer Networking by Georgia Tech", url: "https://www.coursera.org/learn/computer-networking" },
    { type: "Free Course", title: "Coursera: Introduction to Computer Networks (NYU)", url: "https://www.coursera.org/learn/introduction-computer-networks" },
    { type: "Free Course", title: "edX: Computer Networks (Stanford)", url: "https://www.edx.org/learn/computer-networks/stanford-university-computer-networks" },
    { type: "Free Course", title: "Cisco Networking Academy: Introduction to Networks (Free)", url: "https://www.netacad.com/courses/networking/introduction-networks" },
    { type: "Paid Course", title: "Udemy: CompTIA Network+ Complete Course (Mike Meyers)", url: "https://www.udemy.com/course/comptia-network-n10-008-complete-course-cheat-sheets/" },
    { type: "Paid Course", title: "Udemy: Cisco CCNA 200-301 Complete Course (Neil Anderson)", url: "https://www.udemy.com/course/ccna-complete-course-200-301/" },
    { type: "Paid Course", title: "Pluralsight: Computer Networking Fundamentals", url: "https://www.pluralsight.com/courses/computer-networking-fundamentals" },
    { type: "Paid Course", title: "Educative.io: Grokking Computer Networking for Software Engineers", url: "https://www.educative.io/courses/grokking-computer-networking-for-software-engineers" },
    { type: "YouTube Video", title: "NetworkChuck: Free CCNA Course", url: "https://www.youtube.com/playlist?list=PLIhvC56v6wIPdShxkfG37S3Vlaa2Zc3i1" },
    { type: "YouTube Video", title: "freeCodeCamp: Computer Networking Tutorial", url: "https://www.youtube.com/watch?v=IPvYjXofLQY" },
    { type: "YouTube Video", title: "PowerCert Animated Videos: Computer Networking Basics", url: "https://www.youtube.com/watch?v=rL8X2UtJnPw" },
    { type: "YouTube Video", title: "NPTEL: Computer Networks Playlist", url: "https://www.youtube.com/playlist?list=PLbRMhDVUMngfdzI4A6u4Gv8W69kK7k1r8" }
  ],
  "Software Engineering": [
    { type: "Free Course", title: "edX: Software Engineering Introduction by UBC", url: "https://www.edx.org/course/software-engineering-introduction" },
    { type: "Free Course", title: "Coursera: Software Development Lifecycle Specialization", url: "https://www.coursera.org/specializations/software-development-lifecycle" },
    { type: "Free Course", title: "Coursera: Introduction to Software Engineering (IBM)", url: "https://www.coursera.org/learn/introduction-to-software-engineering" },
    { type: "Free Course", title: "MIT OpenCourseWare: Software Engineering", url: "https://ocw.mit.edu/courses/1-124j-software-engineering-fall-2000/" },
    { type: "Paid Course", title: "Udemy: Clean Code by Maximilian Schwarzmüller", url: "https://www.udemy.com/course/clean-code/" },
    { type: "Paid Course", title: "Udemy: Software Engineering Masterclass", url: "https://www.udemy.com/course/software-engineering-masterclass/" },
    { type: "Paid Course", title: "Pluralsight: Software Engineering Principles", url: "https://www.pluralsight.com/courses/software-engineering-principles" },
    { type: "Paid Course", title: "Educative.io: Software Design Patterns", url: "https://www.educative.io/courses/software-design-patterns-best-practices" },
    { type: "YouTube Video", title: "Web Dev Simplified: Software Engineering Tips", url: "https://www.youtube.com/@WebDevSimplified" },
    { type: "YouTube Video", title: "freeCodeCamp: Software Engineering Basics", url: "https://www.youtube.com/watch?v=sg8n7Aom5L8" },
    { type: "YouTube Video", title: "Programming with Mosh: Software Design Patterns", url: "https://www.youtube.com/watch?v=v9ejT8FO-7I" },
    { type: "YouTube Video", title: "Derek Banas: Design Patterns Video", url: "https://www.youtube.com/watch?v=vNHpsC5M_81" }
  ],
  "Python": [
    { type: "Free Course", title: "Coursera: Programming for Everybody (Python) (Michigan)", url: "https://www.coursera.org/learn/python" },
    { type: "Free Course", title: "Coursera: Google IT Automation with Python", url: "https://www.coursera.org/professional-certificates/google-it-automation" },
    { type: "Free Course", title: "Coursera: Python 3 Programming Specialization", url: "https://www.coursera.org/specializations/python-3-programming" },
    { type: "Free Course", title: "Harvard University: CS50's Introduction to Python", url: "https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-programming-with-python" },
    { type: "Paid Course", title: "Udemy: 100 Days of Code: Complete Python Pro Bootcamp", url: "https://www.udemy.com/course/100-days-of-code/" },
    { type: "Paid Course", title: "Udemy: Complete Python Developer: Zero to Mastery", url: "https://www.udemy.com/course/complete-python-developer-zero-to-mastery/" },
    { type: "Paid Course", title: "Pluralsight: Python Core Language", url: "https://www.pluralsight.com/courses/python-core-language" },
    { type: "Paid Course", title: "Educative.io: Learn Python 3 from Scratch", url: "https://www.educative.io/courses/learn-python-3-from-scratch" },
    { type: "YouTube Video", title: "freeCodeCamp: Python for Beginners", url: "https://www.youtube.com/watch?v=rfscVS0vtbw" },
    { type: "YouTube Video", title: "Programming with Mosh: Python Tutorial", url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc" },
    { type: "YouTube Video", title: "Corey Schafer: Python Beginner Playlist", url: "https://www.youtube.com/playlist?list=PL-osiE80TeTt2d9bfVyTiXJA-UTHn6WwU" },
    { type: "YouTube Video", title: "Tech With Tim: Python Tutorial for Beginners", url: "https://www.youtube.com/playlist?list=PLzMcBGgpBvix4cooe1r57c82c_l7cZ8pU" }
  ],
  "Java": [
    { type: "Free Course", title: "Coursera: Object Oriented Programming in Java (Duke)", url: "https://www.coursera.org/specializations/object-oriented-programming-java" },
    { type: "Free Course", title: "Coursera: Java Programming Fundamentals (Duke)", url: "https://www.coursera.org/specializations/java-programming" },
    { type: "Free Course", title: "edX: Java Programming (Carlos III)", url: "https://www.edx.org/learn/java/universidad-carlos-iii-de-madrid-introduction-to-java-programming-starting-to-code-in-java" },
    { type: "Free Course", title: "Udemy: Java Tutorial for Beginners", url: "https://www.udemy.com/course/java-tutorial/" },
    { type: "Paid Course", title: "Udemy: Java 17 Masterclass: Start Coding", url: "https://www.udemy.com/course/java-the-complete-java-developer-course/" },
    { type: "Paid Course", title: "Udemy: Core Java Made Easy (Bharat Acharya)", url: "https://www.udemy.com/course/core-java-made-easy/" },
    { type: "Paid Course", title: "Pluralsight: Java Language Fundamentals", url: "https://www.pluralsight.com/courses/java-language-fundamentals" },
    { type: "Paid Course", title: "Educative.io: Java Multithreading for High Performance", url: "https://www.educative.io/courses/java-multithreading-for-high-performance" },
    { type: "YouTube Video", title: "freeCodeCamp: Java Programming Course", url: "https://www.youtube.com/watch?v=A74TOX803D0" },
    { type: "YouTube Video", title: "freeCodeCamp: Java Tutorial for Beginners", url: "https://www.youtube.com/watch?v=grEKMHGYyns" },
    { type: "YouTube Video", title: "Programming with Mosh: Java Tutorial", url: "https://www.youtube.com/watch?v=eIrMbLyxt9A" },
    { type: "YouTube Video", title: "Telusko: Java Tutorial for Beginners", url: "https://www.youtube.com/playlist?list=PLsyeobzWly7oAZg50Sp5R0YrqzV5h3sS_" }
  ],
  "JavaScript": [
    { type: "Free Course", title: "Coursera: Programming with JavaScript (Meta)", url: "https://www.coursera.org/learn/programming-with-javascript" },
    { type: "Free Course", title: "Coursera: HTML, CSS, and Javascript for Web Developers", url: "https://www.coursera.org/learn/html-css-javascript-for-web-developers" },
    { type: "Free Course", title: "edX: JavaScript Introduction (W3C)", url: "https://www.edx.org/learn/javascript/w3cx-javascript-introduction" },
    { type: "Free Course", title: "freeCodeCamp: Learn JavaScript - Full Course", url: "https://www.youtube.com/watch?v=PkZNo7MFNFg" },
    { type: "Paid Course", title: "Udemy: The Complete JavaScript Course: Zero to Expert!", url: "https://www.udemy.com/course/the-complete-javascript-course/" },
    { type: "Paid Course", title: "Udemy: Modern JavaScript From The Beginning (Brad Traversy)", url: "https://www.udemy.com/course/modern-javascript-from-the-beginning/" },
    { type: "Paid Course", title: "Pluralsight: JavaScript Core Language", url: "https://www.pluralsight.com/courses/javascript-core-language" },
    { type: "Paid Course", title: "Educative.io: ES6 and Beyond", url: "https://www.educative.io/courses/modern-javascript-es6-and-beyond" },
    { type: "YouTube Video", title: "JavaScript Mastery: Complete Web Dev", url: "https://www.youtube.com/@javascriptmastery" },
    { type: "YouTube Video", title: "Programming with Mosh: JavaScript Tutorial", url: "https://www.youtube.com/watch?v=W608U66V51s" },
    { type: "YouTube Video", title: "freeCodeCamp: JavaScript Tutorial", url: "https://www.youtube.com/watch?v=hKB-YGF14RU" },
    { type: "YouTube Video", title: "SuperSimpleDev: JavaScript Full Course", url: "https://www.youtube.com/watch?v=SBmSRK3feww" }
  ],
  "C++": [
    { type: "Free Course", title: "Udacity: C++ For Programmers", url: "https://www.udacity.com/course/c-for-programmers--ud210" },
    { type: "Free Course", title: "Coursera: Coding for Everyone: C and C++ (UC Santa Cruz)", url: "https://www.coursera.org/specializations/coding-for-everyone" },
    { type: "Free Course", title: "edX: C++ Programming (Carlos III)", url: "https://www.edx.org/learn/c/universidad-carlos-iii-de-madrid-introduction-to-c-programming" },
    { type: "Free Course", title: "Great Learning: C++ for Beginners (Free)", url: "https://www.mygreatlearning.com/academy/learn-for-free/courses/c-for-beginners" },
    { type: "Paid Course", title: "Udemy: Beginning C++ Programming - Beginner to Beyond", url: "https://www.udemy.com/course/beginning-c-plus-plus-programming/" },
    { type: "Paid Course", title: "Udemy: Learn C++ Programming (Abdul Bari)", url: "https://www.udemy.com/course/cpp-deep-dive/" },
    { type: "Paid Course", title: "Pluralsight: C++ Fundamentals", url: "https://www.pluralsight.com/courses/cpp-fundamentals" },
    { type: "Paid Course", title: "Educative.io: C++ for Programmer Interviews", url: "https://www.educative.io/courses/cpp-for-programmer-interviews" },
    { type: "YouTube Video", title: "freeCodeCamp: C++ Tutorial for Beginners", url: "https://www.youtube.com/watch?v=vLnPwxZdW4Y" },
    { type: "YouTube Video", title: "freeCodeCamp: C++ Programming for Beginners", url: "https://www.youtube.com/watch?v=18c3MTX0PK0" },
    { type: "YouTube Video", title: "The Cherno: C++ Series", url: "https://www.youtube.com/playlist?list=PLlrATfipKeqV2OPgfFrHy5fEgDYF7Y8cR" },
    { type: "YouTube Video", title: "Gate Smashers: C++ Programming", url: "https://www.youtube.com/playlist?list=PLmXKhU9mM_rdC1Xp01B5y0C2tVv_qO4Kz" }
  ],
  "Marketing": [
    { type: "Free Course", title: "Coursera: Introduction to Marketing by Wharton", url: "https://www.coursera.org/learn/wharton-marketing" },
    { type: "Free Course", title: "Coursera: Google Digital Marketing Professional Certificate", url: "https://www.coursera.org/professional-certificates/google-digital-marketing-ecommerce" },
    { type: "Free Course", title: "edX: Fundamentals of Digital Marketing (UMd)", url: "https://www.edx.org/learn/digital-marketing/the-university-of-maryland-college-park-fundamentals-of-digital-marketing" },
    { type: "Free Course", title: "Google Digital Garage: Fundamentals of Digital Marketing", url: "https://skillshop.exceedlms.com/student/path/182881-fundamentals-of-digital-marketing" },
    { type: "Paid Course", title: "Udemy: The Complete Digital Marketing Course", url: "https://www.udemy.com/course/learn-digital-marketing-course/" },
    { type: "Paid Course", title: "Udemy: Marketing Management Masterclass", url: "https://www.udemy.com/course/marketing-management-masterclass/" },
    { type: "Paid Course", title: "Pluralsight: Marketing Principles", url: "https://www.pluralsight.com/courses/marketing-principles" },
    { type: "Paid Course", title: "Educative.io: Digital Marketing Strategies", url: "https://www.educative.io/courses/digital-marketing-strategies" },
    { type: "YouTube Video", title: "HubSpot Marketing Channel", url: "https://www.youtube.com/@HubSpotMarketing" },
    { type: "YouTube Video", title: "freeCodeCamp: Digital Marketing Course", url: "https://www.youtube.com/watch?v=nU-IIX3hyS4" },
    { type: "YouTube Video", title: "GaryVee: Marketing Strategies", url: "https://www.youtube.com/@garyvee" },
    { type: "YouTube Video", title: "Neil Patel: Digital Marketing Tutorials", url: "https://www.youtube.com/@neilpatel" }
  ],
  "Finance": [
    { type: "Free Course", title: "Coursera: Finance for Non-Financial Professionals", url: "https://www.coursera.org/learn/finance-for-non-finance" },
    { type: "Free Course", title: "Coursera: Financial Markets by Yale", url: "https://www.coursera.org/learn/financial-markets-global" },
    { type: "Free Course", title: "edX: Introduction to Corporate Finance (Columbia)", url: "https://www.edx.org/learn/corporate-finance/columbia-university-corporate-finance-introduction" },
    { type: "Free Course", title: "MIT OpenCourseWare: Finance Theory I", url: "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/" },
    { type: "Paid Course", title: "Udemy: The Complete Financial Analyst Course", url: "https://www.udemy.com/course/the-complete-financial-analyst-course/" },
    { type: "Paid Course", title: "Udemy: Investment Banking Complete Course", url: "https://www.udemy.com/course/investment-banking-course-principles-and-practice/" },
    { type: "Paid Course", title: "Pluralsight: Financial Accounting Fundamentals", url: "https://www.pluralsight.com/courses/financial-accounting-fundamentals" },
    { type: "Paid Course", title: "Educative.io: Finance & Accounting for Engineers", url: "https://www.educative.io/courses/finance-accounting-for-software-engineers" },
    { type: "YouTube Video", title: "Khan Academy: Finance and Capital Markets", url: "https://www.youtube.com/playlist?list=PL584D7203FD386377" },
    { type: "YouTube Video", title: "freeCodeCamp: Financial Analysis Course", url: "https://www.youtube.com/watch?v=1F_U-wU_mP0" },
    { type: "YouTube Video", title: "Corporate Finance Institute: Financial Modeling", url: "https://www.youtube.com/@CorporateFinanceInstitute" },
    { type: "YouTube Video", title: "Aswath Damodaran: Corporate Finance Playlist", url: "https://www.youtube.com/@AswathDamodaranOnValuation" }
  ],
  "Human Resources": [
    { type: "Free Course", title: "Coursera: HR for People Managers Specialization", url: "https://www.coursera.org/specializations/human-resource-management" },
    { type: "Free Course", title: "Coursera: Managing Social and Human Capital (Wharton)", url: "https://www.coursera.org/learn/managing-social-human-capital" },
    { type: "Free Course", title: "edX: Strategic HR Management (IIMB)", url: "https://www.edx.org/learn/human-resources/indian-institute-of-management-bangalore-strategic-human-resource-management" },
    { type: "Free Course", title: "Great Learning: Introduction to HR Management", url: "https://www.mygreatlearning.com/academy/learn-for-free/courses/introduction-to-hr-management" },
    { type: "Paid Course", title: "Udemy: World-Class HR Associate & Manager Certification", url: "https://www.udemy.com/course/human-resources-management-certification/" },
    { type: "Paid Course", title: "Udemy: Strategic HR Management Masterclass", url: "https://www.udemy.com/course/strategic-hr-management/" },
    { type: "Paid Course", title: "Pluralsight: Human Resource Management Basics", url: "https://www.pluralsight.com/courses/human-resource-management-basics" },
    { type: "Paid Course", title: "Educative.io: Leading High-Performing Teams", url: "https://www.educative.io/courses/leading-high-performing-teams" },
    { type: "YouTube Video", title: "GreggU: HR Management Lectures", url: "https://www.youtube.com/playlist?list=PL_KuxF09KspA6eZ6vKj5dE16J5xKz8U0C" },
    { type: "YouTube Video", title: "GreggU: Intro to Human Resource Management", url: "https://www.youtube.com/watch?v=Fj79oD5a3h4" },
    { type: "YouTube Video", title: "HR Share: Human Resources Tutorial", url: "https://www.youtube.com/@AIHR" },
    { type: "YouTube Video", title: "Edureka: HR Management Tutorial", url: "https://www.youtube.com/watch?v=PlHnamdwGmo" }
  ],
  "Operations": [
    { type: "Free Course", title: "Coursera: Introduction to Operations Management by Wharton", url: "https://www.coursera.org/learn/wharton-operations" },
    { type: "Free Course", title: "Coursera: Supply Chain Principles (Georgia Tech)", url: "https://www.coursera.org/learn/supply-chain-principles" },
    { type: "Free Course", title: "edX: Operations Management (IIMB)", url: "https://www.edx.org/learn/operations-management/indian-institute-of-management-bangalore-operations-management" },
    { type: "Free Course", title: "MIT OpenCourseWare: Operations Management", url: "https://ocw.mit.edu/courses/15-760-introduction-to-operations-management-spring-2004/" },
    { type: "Paid Course", title: "Udemy: Operations Management A-Z", url: "https://www.udemy.com/course/operations-management-a-z-complete-introduction-course/" },
    { type: "Paid Course", title: "Udemy: Logistics and Supply Chain Management", url: "https://www.udemy.com/course/logistics-supply-chain-management/" },
    { type: "Paid Course", title: "Pluralsight: Operations Management Foundations", url: "https://www.pluralsight.com/courses/operations-management-foundations" },
    { type: "Paid Course", title: "Educative.io: Operations for Startups", url: "https://www.educative.io/courses/operations-for-startups" },
    { type: "YouTube Video", title: "GreggU: Operations Management Lectures", url: "https://www.youtube.com/playlist?list=PL_KuxF09KspD2D_hJkL9f2k0d0uD30uK4" },
    { type: "YouTube Video", title: "GreggU: Supply Chain Management Basics", url: "https://www.youtube.com/watch?v=b0V-y9E_v1c" },
    { type: "YouTube Video", title: "Edureka: Supply Chain Management Tutorial", url: "https://www.youtube.com/watch?v=mHn412VvHec" },
    { type: "YouTube Video", title: "Corporate Finance Institute: Operations Management", url: "https://www.youtube.com/@CorporateFinanceInstitute" }
  ],
  "Project Management": [
    { type: "Free Course", title: "Coursera: Google Project Management Professional Certificate", url: "https://www.coursera.org/professional-certificates/google-project-management" },
    { type: "Free Course", title: "Coursera: Introduction to Project Management (UCI)", url: "https://www.coursera.org/learn/project-management-basics" },
    { type: "Free Course", title: "edX: Project Management Lifecycle (RIT)", url: "https://www.edx.org/learn/project-management/rochester-institute-of-technology-project-management-life-cycle" },
    { type: "Free Course", title: "Great Learning: Project Management Basics", url: "https://www.mygreatlearning.com/academy/learn-for-free/courses/project-management-basics" },
    { type: "Paid Course", title: "Udemy: PMP Exam Prep Seminar by Joseph Phillips", url: "https://www.udemy.com/course/pmp-pmbok6-35-pdus/" },
    { type: "Paid Course", title: "Udemy: Complete Agile Scrum Master Masterclass", url: "https://www.udemy.com/course/agile-scrum-masterclass/" },
    { type: "Paid Course", title: "Pluralsight: Project Management Professional (PMP) Prep", url: "https://www.pluralsight.com/courses/pmp-prep" },
    { type: "Paid Course", title: "Educative.io: Grokking the Project Management Interview", url: "https://www.educative.io/courses/grokking-the-project-management-interview" },
    { type: "YouTube Video", title: "Project Management Videos: Channel", url: "https://www.youtube.com/@ProjectManagerVideos" },
    { type: "YouTube Video", title: "freeCodeCamp: Project Management Course", url: "https://www.youtube.com/watch?v=hK7_gW2k4p8" },
    { type: "YouTube Video", title: "Edureka: Project Management Full Course", url: "https://www.youtube.com/watch?v=3Wd6Zq1_6m0" },
    { type: "YouTube Video", title: "Simplilearn: Project Management Tutorial", url: "https://www.youtube.com/watch?v=kYJ4t_vND6I" }
  ],
  "Entrepreneurship": [
    { type: "Free Course", title: "Coursera: Entrepreneurship Specialization by Wharton", url: "https://www.coursera.org/specializations/wharton-entrepreneurship" },
    { type: "Free Course", title: "Coursera: Startup Valuation Methods", url: "https://www.coursera.org/learn/startup-valuation" },
    { type: "Free Course", title: "edX: Entrepreneurship in Emerging Economies (Harvard)", url: "https://www.edx.org/learn/entrepreneurship/harvard-university-entrepreneurship-in-emerging-economies" },
    { type: "Free Course", title: "MIT OpenCourseWare: Entrepreneurship 101", url: "https://ocw.mit.edu/courses/15-390-entrepreneurship-101-mit-fall-2013/" },
    { type: "Paid Course", title: "Udemy: How to Start a Business: Ultimate Guide", url: "https://www.udemy.com/course/how-to-start-a-business-ultimate-guide-to-business-success/" },
    { type: "Paid Course", title: "Udemy: The Complete Business Plan Course (Chris Haroun)", url: "https://www.udemy.com/course/complete-business-plan-course-template/" },
    { type: "Paid Course", title: "Pluralsight: Entrepreneurship Fundamentals", url: "https://www.pluralsight.com/courses/entrepreneurship-fundamentals" },
    { type: "Paid Course", title: "Educative.io: Startup Boot Camp for Developers", url: "https://www.educative.io/courses/startup-bootcamp" },
    { type: "YouTube Video", title: "Y Combinator: Startup School Channel", url: "https://www.youtube.com/@ycombinator" },
    { type: "YouTube Video", title: "Y Combinator: How to Start a Startup", url: "https://www.youtube.com/playlist?list=PL5q_lef6zVkaTY_cT1k7qFNF2TidHCe-1" },
    { type: "YouTube Video", title: "Valuetainment: Entrepreneurship Channel", url: "https://www.youtube.com/@Valuetainment" },
    { type: "YouTube Video", title: "Stanford eCorner: Entrepreneurial Thought Leaders", url: "https://www.youtube.com/@stanfordecorner" }
  ],
  "AI/ML": [
    { type: "Free Course", title: "Coursera: Machine Learning Specialization (Stanford)", url: "https://www.coursera.org/specializations/machine-learning-introduction" },
    { type: "Free Course", title: "Fast.ai: Practical Deep Learning for Coders", url: "https://course.fast.ai/" },
    { type: "Free Course", title: "Google: Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course" },
    { type: "Free Course", title: "Coursera: Deep Learning Specialization", url: "https://www.coursera.org/specializations/deep-learning" },
    { type: "Paid Course", title: "Udemy: Machine Learning A-Z (Kirill Eremenko)", url: "https://www.udemy.com/course/machinelearning/" },
    { type: "Paid Course", title: "Udemy: Python for Data Science and Machine Learning", url: "https://www.udemy.com/course/python-for-data-science-and-machine-learning-bootcamp/" },
    { type: "Paid Course", title: "Pluralsight: Machine Learning Foundations", url: "https://www.pluralsight.com/courses/machine-learning-foundations" },
    { type: "Paid Course", title: "Educative.io: Grokking Machine Learning", url: "https://www.educative.io/courses/grokking-machine-learning" },
    { type: "YouTube Video", title: "StatQuest with Josh Starmer: ML Playlist", url: "https://www.youtube.com/playlist?list=PLblh5JKOoLUICTaGLRoHQDuF_7q2GfuJF" },
    { type: "YouTube Video", title: "freeCodeCamp: Machine Learning Course", url: "https://www.youtube.com/watch?v=IpGxLWOIZy4" },
    { type: "YouTube Video", title: "3Blue1Brown: Neural Networks", url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi" },
    { type: "YouTube Video", title: "Lex Fridman: Deep Learning Seminars", url: "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGDi1g74VnZa" }
  ],
  "Cybersecurity": [
    { type: "Free Course", title: "Coursera: Introduction to Cybersecurity (Google)", url: "https://www.coursera.org/professional-certificates/google-cybersecurity" },
    { type: "Free Course", title: "Coursera: Introduction to Cyber Security Specialization (NYU)", url: "https://www.coursera.org/specializations/cybersecurity" },
    { type: "Free Course", title: "edX: Cybersecurity Fundamentals (RIT)", url: "https://www.edx.org/learn/cybersecurity/rochester-institute-of-technology-cybersecurity-fundamentals" },
    { type: "Free Course", title: "Cybrary: CompTIA Security+ Course", url: "https://www.cybrary.it/course/comptia-security-plus" },
    { type: "Paid Course", title: "Udemy: CompTIA Security+ (Jason Dion)", url: "https://www.udemy.com/course/securityplus/" },
    { type: "Paid Course", title: "Udemy: Complete Cyber Security Course (Nathan House)", url: "https://www.udemy.com/course/the-complete-cyber-security-course-volume-1-hackers-exposed/" },
    { type: "Paid Course", title: "Pluralsight: Cybersecurity Foundations", url: "https://www.pluralsight.com/courses/cybersecurity-foundations" },
    { type: "Paid Course", title: "Educative.io: Web Security & Hacking", url: "https://www.educative.io/courses/web-security-hacking-prevention" },
    { type: "YouTube Video", title: "NetworkChuck: Cyber Security Course", url: "https://www.youtube.com/playlist?list=PLIhvC56v6wIPm_7k3_Vn2wUoe4C3o_wM2" },
    { type: "YouTube Video", title: "freeCodeCamp: Cybersecurity Course for Beginners", url: "https://www.youtube.com/watch?v=3Kq1MIfTWCE" },
    { type: "YouTube Video", title: "John Hammond: Cybersecurity Channel", url: "https://www.youtube.com/@JohnHammond010" },
    { type: "YouTube Video", title: "Edureka: Cybersecurity Live Tutorials", url: "https://www.youtube.com/watch?v=PlHnamdwGmo" }
  ],
  "Digital Electronics": [
    { type: "Free Course", title: "Coursera: Introduction to Digital Systems (UAB)", url: "https://www.coursera.org/learn/digital-systems" },
    { type: "Free Course", title: "edX: Computation Structures (MITx)", url: "https://www.edx.org/learn/computer-science/massachusetts-institute-of-technology-computation-structures-1-digital-circuits" },
    { type: "Free Course", title: "MIT OpenCourseWare: Introductory Digital Systems Laboratory", url: "https://ocw.mit.edu/courses/6-111-introductory-digital-systems-laboratory-spring-2006/" },
    { type: "Free Course", title: "NPTEL: Digital Electronic Circuits", url: "https://onlinecourses.nptel.ac.in/noc20_ee32/preview" },
    { type: "Paid Course", title: "Udemy: Digital Electronics from Scratch", url: "https://www.udemy.com/course/digital-electronics-robotics/" },
    { type: "Paid Course", title: "Udemy: Digital Design & Computer Architecture", url: "https://www.udemy.com/course/digital-design/" },
    { type: "Paid Course", title: "Pluralsight: Digital Logic & Hardware Description", url: "https://www.pluralsight.com/courses/digital-logic-hardware" },
    { type: "Paid Course", title: "Educative.io: Introduction to Digital Logic", url: "https://www.educative.io/courses/digital-design-for-beginners" },
    { type: "YouTube Video", title: "Neso Academy: Digital Electronics Playlist", url: "https://www.youtube.com/playlist?list=PLBlnK6fEyqRjMH3fHSgfdw356ZqyREfQN" },
    { type: "YouTube Video", title: "Gate Smashers: Digital Electronics Playlist", url: "https://www.youtube.com/playlist?list=PLmXKhU9mM_rcA0C16QkS25O_4Uv4-yVb4" },
    { type: "YouTube Video", title: "Crash Course Computer Science: Digital Electronics", url: "https://www.youtube.com/watch?v=lNuPy-r1GuQ" },
    { type: "YouTube Video", title: "All About Electronics: Digital Electronics", url: "https://www.youtube.com/playlist?list=PLmQ7X8_w_o1ZtV7l7Hskz_xLphPswp5T1" }
  ],
  "Microprocessors": [
    { type: "Free Course", title: "edX: Computation Structures: Computer Architecture", url: "https://www.edx.org/learn/computer-science/massachusetts-institute-of-technology-computation-structures-2-computer-architecture" },
    { type: "Free Course", title: "Coursera: Computer Architecture (Princeton)", url: "https://www.coursera.org/learn/comparch" },
    { type: "Free Course", title: "NPTEL: Microprocessors and Microcontrollers", url: "https://onlinecourses.nptel.ac.in/noc21_ee16/preview" },
    { type: "Free Course", title: "MIT OpenCourseWare: Computer System Architecture", url: "https://ocw.mit.edu/courses/6-823-computer-system-architecture-fall-2005/" },
    { type: "Paid Course", title: "Udemy: Microprocessor 8085 Assembly Language", url: "https://www.udemy.com/course/8085-microprocessor/" },
    { type: "Paid Course", title: "Udemy: Computer Organization and Architecture", url: "https://www.udemy.com/course/computer-organization-and-architecture-course/" },
    { type: "Paid Course", title: "Pluralsight: Assembly Language Programming", url: "https://www.pluralsight.com/courses/assembly-language-fundamentals" },
    { type: "Paid Course", title: "Educative.io: Microcontroller Systems & Programming", url: "https://www.educative.io/courses/microcontroller-systems-programming" },
    { type: "YouTube Video", title: "Bharat Acharya Education: Microprocessor Lectures", url: "https://www.youtube.com/@BharatAcharyaEducation" },
    { type: "YouTube Video", title: "Neso Academy: Microprocessor Tutorials", url: "https://www.youtube.com/playlist?list=PLBlnK6fEyqRggqB0hE3B8K6cpxj5h_55T" },
    { type: "YouTube Video", title: "Gate Smashers: Microprocessors and Microcontrollers", url: "https://www.youtube.com/playlist?list=PLmXKhU9mM_rdm6_B8U6gT1qW8_S_z2MvM" },
    { type: "YouTube Video", title: "All About Electronics: Microprocessor 8085", url: "https://www.youtube.com/playlist?list=PLmQ7X8_w_o1Zp651yG_tE_1Qn39GZ9M1I" }
  ],
  "Signal Processing": [
    { type: "Free Course", title: "Coursera: Digital Signal Processing (EPFL)", url: "https://www.coursera.org/learn/dsp" },
    { type: "Free Course", title: "edX: Discrete-Time Signal Processing (MITx)", url: "https://www.edx.org/learn/signal-processing/massachusetts-institute-of-technology-discrete-time-signal-processing" },
    { type: "Free Course", title: "MIT OpenCourseWare: Signals and Systems", url: "https://ocw.mit.edu/courses/6-003-signals-and-systems-fall-2011/" },
    { type: "Free Course", title: "NPTEL: Digital Signal Processing", url: "https://onlinecourses.nptel.ac.in/noc20_ee83/preview" },
    { type: "Paid Course", title: "Udemy: Signal Processing with MATLAB", url: "https://www.udemy.com/course/signal-processing-matlab/" },
    { type: "Paid Course", title: "Udemy: Digital Signal Processing (DSP) - Complete Guide", url: "https://www.udemy.com/course/digital-signal-processing/" },
    { type: "Paid Course", title: "Pluralsight: Signals and Systems Basics", url: "https://www.pluralsight.com/courses/signals-systems-basics" },
    { type: "Paid Course", title: "Educative.io: Mathematical Fundamentals for DSP", url: "https://www.educative.io/courses/math-for-dsp" },
    { type: "YouTube Video", title: "NPTEL: Digital Signal Processing Playlist", url: "https://www.youtube.com/playlist?list=PLbRMhDVUMngfdzI4A6u4Gv8W69kK7k1r8" },
    { type: "YouTube Video", title: "Neso Academy: Signals and Systems", url: "https://www.youtube.com/playlist?list=PLBlnK6fEyqRkO_c1T2Gg6G8k4VzNn5rP1" },
    { type: "YouTube Video", title: "All About Electronics: DSP Tutorials", url: "https://www.youtube.com/playlist?list=PLmQ7X8_w_o1Yp46R_C7W90rYV9kU0Jq7s" },
    { type: "YouTube Video", title: "Discrete Time Signal Processing Tutorial", url: "https://www.youtube.com/watch?v=yWqySRz8l5o" }
  ],
  "Communication Systems": [
    { type: "Free Course", title: "Coursera: Principles of Digital Communications (EPFL)", url: "https://www.coursera.org/learn/principles-digital-communications" },
    { type: "Free Course", title: "edX: Principles of Wireless Communications (IITB)", url: "https://www.edx.org/learn/communication/indian-institute-of-technology-bombay-principles-of-wireless-communications" },
    { type: "Free Course", title: "MIT OpenCourseWare: Intro to Communication, Control, Signal", url: "https://ocw.mit.edu/courses/6-011-introduction-to-communication-control-and-signal-processing-spring-2010/" },
    { type: "Free Course", title: "NPTEL: Principles of Communication Systems", url: "https://onlinecourses.nptel.ac.in/noc21_ee45/preview" },
    { type: "Paid Course", title: "Udemy: Wireless Communication Systems Course", url: "https://www.udemy.com/course/wireless-communications/" },
    { type: "Paid Course", title: "Udemy: Digital Communication Systems Guide", url: "https://www.udemy.com/course/digital-communications/" },
    { type: "Paid Course", title: "Pluralsight: Intro to Wireless Networking", url: "https://www.pluralsight.com/courses/intro-wireless-networking" },
    { type: "Paid Course", title: "Educative.io: Digital Transmission Fundamentals", url: "https://www.educative.io/courses/digital-transmission" },
    { type: "YouTube Video", title: "Neso Academy: Analog & Digital Communications", url: "https://www.youtube.com/playlist?list=PLBlnK6fEyqRjK6fE3jPcx_8_P4vW6d_W2" },
    { type: "YouTube Video", title: "Gate Smashers: Communication Engineering", url: "https://www.youtube.com/playlist?list=PLmXKhU9mM_rdC1Xp01B5y0C2tVv_qO4Kz" },
    { type: "YouTube Video", title: "All About Electronics: Communication Systems", url: "https://www.youtube.com/playlist?list=PLmQ7X8_w_o1Z9w0p0N6a1S4gX87q8P4F_" },
    { type: "YouTube Video", title: "Great Learning: Principles of Digital Communication", url: "https://www.youtube.com/watch?v=3Wd6Zq1_6m0" }
  ],
  "Communication & STAR": [
    { type: "Free Course", title: "Coursera: Introduction to Public Speaking", url: "https://www.coursera.org/learn/publicaddress" },
    { type: "Free Course", title: "Coursera: Effective Communication Specialization (CU)", url: "https://www.coursera.org/specializations/effective-communication" },
    { type: "Free Course", title: "edX: Communicating Strategically (Purdue)", url: "https://www.edx.org/learn/communication/purdue-university-communicating-strategically" },
    { type: "Free Course", title: "Great Learning: Effective Communication Skills", url: "https://www.mygreatlearning.com/academy/learn-for-free/courses/effective-communication-skills" },
    { type: "Paid Course", title: "Udemy: Complete Presentation Skills Masterclass", url: "https://www.udemy.com/course/complete-presentation-skills-masterclass-for-every-occasion/" },
    { type: "Paid Course", title: "Udemy: Communication Skills for Modern Managers", url: "https://www.udemy.com/course/communication-skills-for-modern-managers/" },
    { type: "Paid Course", title: "Pluralsight: Effective Communication for Professionals", url: "https://www.pluralsight.com/courses/effective-communication-tech-professionals" },
    { type: "Paid Course", title: "Educative.io: Communication Skills for Engineers", url: "https://www.educative.io/courses/communication-skills-for-software-engineers" },
    { type: "YouTube Video", title: "Linda Raynier: STAR Method Interview Answers", url: "https://www.youtube.com/watch?v=W608U66V51s" },
    { type: "YouTube Video", title: "freeCodeCamp: Professional Communication Tutorial", url: "https://www.youtube.com/watch?v=3Wd6Zq1_6m0" },
    { type: "YouTube Video", title: "Charisma on Command: Communication Hacks", url: "https://www.youtube.com/@CharismaonCommand" },
    { type: "YouTube Video", title: "CareerVidz: How to Answer Behavioral Questions", url: "https://www.youtube.com/@CareerVidz" }
  ],
  "Visual Presence & Posture": [
    { type: "Free Course", title: "Coursera: Introduction to Communication Science", url: "https://www.coursera.org/learn/communication-science" },
    { type: "Free Course", title: "Coursera: Public Speaking", url: "https://www.coursera.org/learn/publicaddress" },
    { type: "Free Course", title: "edX: Presentation Skills: Designing Slides (RIT)", url: "https://www.edx.org/learn/presentation-skills/rochester-institute-of-technology-presentation-skills-designing-presentation-slides" },
    { type: "Free Course", title: "OpenLearn: Body Language Basics", url: "https://www.open.edu/openlearn/body-language-basics" },
    { type: "Paid Course", title: "Udemy: Body Language for Entrepreneurs", url: "https://www.udemy.com/course/body-language-for-entrepreneurs/" },
    { type: "Paid Course", title: "Udemy: Complete Body Language Masterclass", url: "https://www.udemy.com/course/body-language-mastery/" },
    { type: "Paid Course", title: "Pluralsight: Executive Presence for Technologists", url: "https://www.pluralsight.com/courses/executive-presence-technologists" },
    { type: "Paid Course", title: "Educative.io: Professional Presence in Video Interviews", url: "https://www.educative.io/courses/professional-presence" },
    { type: "YouTube Video", title: "Science of People by Vanessa Van Edwards", url: "https://www.youtube.com/@ScienceofPeople" },
    { type: "YouTube Video", title: "TEDx: Body Language Shapes Who You Are (Amy Cuddy)", url: "https://www.youtube.com/watch?v=Ks-_Mh1QhMc" },
    { type: "YouTube Video", title: "Science of People: Body Language Cues", url: "https://www.youtube.com/watch?v=d_xKjWsnWb0" },
    { type: "YouTube Video", title: "CareerVidz: Video Interview Tips (Body Language)", url: "https://www.youtube.com/@CareerVidz" }
  ],
  "Voice Control & Fluency": [
    { type: "Free Course", title: "edX: Effective Business Communication by IIMB", url: "https://www.edx.org/learn/business-communication/indian-institute-of-management-bangalore-effective-business-communication" },
    { type: "Free Course", title: "Coursera: Business English Communication (UW)", url: "https://www.coursera.org/specializations/business-english" },
    { type: "Free Course", title: "Coursera: Effective Public Speaking", url: "https://www.coursera.org/learn/publicaddress" },
    { type: "Free Course", title: "Great Learning: Spoken English for Professionals", url: "https://www.mygreatlearning.com/academy/learn-for-free/courses/spoken-english-for-professionals" },
    { type: "Paid Course", title: "Udemy: Voice Training 30-Day Vocal Program", url: "https://www.udemy.com/course/voice-training-30-day-vocal-exercises-peter-baker/" },
    { type: "Paid Course", title: "Udemy: Speak Confidently & Influence Others", url: "https://www.udemy.com/course/speak-confidently-voice-training/" },
    { type: "Paid Course", title: "Pluralsight: Vocal Excellence for Speakers", url: "https://www.pluralsight.com/courses/vocal-excellence-speakers" },
    { type: "Paid Course", title: "Educative.io: Mastering Spoken English in Interviews", url: "https://www.educative.io/courses/mastering-spoken-english" },
    { type: "YouTube Video", title: "Charisma on Command: Speak with Confidence", url: "https://www.youtube.com/watch?v=58j9wZ4bJns" },
    { type: "YouTube Video", title: "Charisma on Command: Speak Confidently on the Spot", url: "https://www.youtube.com/watch?v=Adw01S-4H6Q" },
    { type: "YouTube Video", title: "English Class 101: Fluency and Voice Control", url: "https://www.youtube.com/@EnglishClass101" },
    { type: "YouTube Video", title: "CareerVidz: Public Speaking and Voice Hacks", url: "https://www.youtube.com/@CareerVidz" }
  ],
  "Reasoning & Logic": [
    { type: "Free Course", title: "Coursera: Introduction to Mathematical Thinking", url: "https://www.coursera.org/learn/mathematical-thinking" },
    { type: "Free Course", title: "Coursera: Think Again I: How to Understand Arguments", url: "https://www.coursera.org/learn/understanding-arguments-introduction" },
    { type: "Free Course", title: "edX: Analytical Thinking & Reasoning (UQ)", url: "https://www.edx.org/learn/analytical-thinking/the-university-of-queensland-analytical-thinking-reasoning" },
    { type: "Free Course", title: "Khan Academy: Algebra and Logical Reasoning", url: "https://www.khanacademy.org/math/algebra" },
    { type: "Paid Course", title: "Udemy: Critical Thinking Strategies For Better Decisions", url: "https://www.udemy.com/course/critical-thinking-strategies-for-better-decisions/" },
    { type: "Paid Course", title: "Udemy: Cognitive Biases & Logical Fallacies Guide", url: "https://www.udemy.com/course/logical-fallacies-cognitive-biases/" },
    { type: "Paid Course", title: "Pluralsight: Analytical Reasoning and Decision Making", url: "https://www.pluralsight.com/courses/analytical-reasoning-decision-making" },
    { type: "Paid Course", title: "Brilliant.org: Logic Courses", url: "https://brilliant.org/logic/" },
    { type: "YouTube Video", title: "TED-Ed: Riddles and Logic Puzzles", url: "https://www.youtube.com/playlist?list=PLJicmE8fK0EiX-S4JcO9D_MskWpyZ4d6v" },
    { type: "YouTube Video", title: "CrashCourse: Philosophy Logic & Arguments", url: "https://www.youtube.com/watch?v=NKEhdsnKKHs" },
    { type: "YouTube Video", title: "MindYourDecisions: Logic Puzzles and Math", url: "https://www.youtube.com/@MindYourDecisions" },
    { type: "YouTube Video", title: "freeCodeCamp: Mathematical Logic & Coding", url: "https://www.youtube.com/watch?v=8hly31xKjhc" }
  ]
};

// Helper to compute threshold based on user profile age (session count)
function computeThreshold(sessionCount: number): number {
  const base = 100 / Math.max(1, sessionCount);
  return Math.min(25, Math.max(3, base)); // clamp between 3% and 25%
}

// Clean model outputs from copyright/signature noise dynamically
function cleanRecommendationContent(content: string): string {
  if (!content) return '';
  let cleanText = content;
  // Strip markdown code block wrapper if model outputted one
  if (cleanText.startsWith('```html')) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();

  // Strip any copyright, footer, or "all rights reserved" text
  cleanText = cleanText.replace(/(?:copyright|©)?\s*(?:20\d{2})?\s*Elite\s*AI\s*Career\s*Coach\.?\s*(?:All\s*rights\s*reserved\.?)?/gi, '');
  cleanText = cleanText.replace(/All\s*rights\s*reserved\.?/gi, '');
  cleanText = cleanText.replace(/Elite\s*AI\s*Career\s*Coach\.?/gi, '');
  return cleanText.trim();
}

// Helper to compile current technical and behavioral scores
async function getUserScores(userId: any, db: Db) {
  // 1. Fetch user profile for interests list
  const profile = await db.collection('user_profile').findOne({ userId });
  const interests = (profile?.interests || []) as string[];

  // 2. Fetch interview metrics
  const interviewDb = await getInterviewDb();
  const sessionDocs = await interviewDb
    .collection(INTERVIEW_COLLECTIONS.sessions)
    .find({ userId })
    .toArray();
  const reportDocs = await interviewDb
    .collection(INTERVIEW_COLLECTIONS.reports)
    .find({ userId, status: 'ready' })
    .toArray();

  const sessions = sessionDocs.map((s) => ({
    sessionId: s._id.toString(),
    role: s.config?.role ?? '—',
    status: s.status,
    reportId: s.reportId ? s.reportId.toString() : null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : new Date(s.createdAt).toISOString(),
    endedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
  }));

  const reports = reportDocs.map((r) => ({
    sessionId: r.sessionId.toString(),
    reportId: r._id.toString(),
    ciScore: r.ciScore,
    categoryScores: r.categoryScores,
    weaknessTags: r.weaknessTags ?? [],
    resources: (r.resources ?? []).map((res: any) => ({
      id: res.id,
      title: res.title,
      url: res.url,
      tags: res.tags ?? [],
    })),
    readyAt: r.readyAt instanceof Date ? r.readyAt.toISOString() : r.readyAt ? new Date(r.readyAt).toISOString() : null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
  }));

  const metrics = computeDashboardMetrics(reports, sessions, new Date(), { trendLimit: 100, recentLimit: 100 });

  // 3. Fetch exam history
  const examHistoryDocs = await db
    .collection('student_exams')
    .find({ userId })
    .toArray();

  // Compile technical skills
  const roleData: Record<string, { sum: number; count: number }> = {};
  metrics.recentSessions.forEach((s: any) => {
    if (s.status === 'completed' && s.categoryScores?.technicalAccuracy != null) {
      const r = s.role;
      if (!roleData[r]) roleData[r] = { sum: 0, count: 0 };
      roleData[r].sum += s.categoryScores.technicalAccuracy;
      roleData[r].count += 1;
    }
  });
  const interviewRoleAccuracies: Record<string, number> = {};
  Object.entries(roleData).forEach(([role, data]) => {
    interviewRoleAccuracies[role] = Math.round(data.sum / data.count);
  });

  const technicalScores: Record<string, number> = {};
  interests.forEach((interest) => {
    let examScoreSum = 0;
    let examScoreCount = 0;
    examHistoryDocs.forEach((doc: any) => {
      if (doc.interests && doc.interests.includes(interest) && doc.attempts) {
        doc.attempts.forEach((a: any) => {
          examScoreSum += a.scorePercentage;
          examScoreCount++;
        });
      }
    });
    const examVal = examScoreCount > 0 ? Math.round(examScoreSum / examScoreCount) : null;
    const interviewVal = interviewRoleAccuracies[interest] ?? null;

    let overallVal = 0;
    if (examVal !== null && interviewVal !== null) {
      overallVal = Math.round((examVal + interviewVal) / 2);
    } else if (examVal !== null) {
      overallVal = examVal;
    } else if (interviewVal !== null) {
      overallVal = interviewVal;
    } else {
      overallVal = 0;
    }
    technicalScores[interest] = overallVal;
  });

  // Compile non-tech skills
  const comm = metrics.categoryAverages?.communication ?? 0;
  const body = metrics.categoryAverages?.bodyCi ?? 0;
  const voice = metrics.categoryAverages?.voiceCi ?? 0;

  let examScoreSum = 0;
  let examScoreCount = 0;
  examHistoryDocs.forEach((doc: any) => {
    if (doc.attempts) {
      doc.attempts.forEach((a: any) => {
        examScoreSum += a.scorePercentage;
        examScoreCount++;
      });
    }
  });
  const reasoning = examScoreCount > 0 ? Math.round(examScoreSum / examScoreCount) : 0;

  const behavioralScores = {
    communication: comm,
    bodyPosture: body,
    voiceModulation: voice,
    reasoningLogic: reasoning
  };

  return {
    technicalScores,
    behavioralScores,
    totalSessions: metrics.totalSessions
  };
}

// Background recommendation generation trigger
async function triggerBackgroundGeneration(user: any, db: Db, currentTechScores: any, currentBehavioralScores: any, currentSessionCount: number) {
  // Start the background promise immediately
  (async () => {
    try {
      const systemPrompt = `You are an elite AI Career Coach. Your job is to analyze the candidate's technical and behavioral skill scores and generate a comprehensive, highly actionable study guide and roadmap.
Your response must be strictly styled HTML (wrapped in a single div, no markdown, no <html> or <body> tags). Use modern, clean Tailwind CSS classes matching a premium dark-mode theme (vibrant amber and teal highlights, glassmorphic card layouts with frosted borders).

IMPORTANT - LAYOUT AND SECTION TABS RULES:
1. You MUST organize your entire response into exactly three top-level HTML <section> tags. Each <section> represents a separate tab in the UI:
   - Section 1: <section id="overall" data-label="Overall Progress">
     * Must contain an Executive Summary & Confidence Analysis of their performance.
     * Include a small high-level summary of recommendations and general learning actions.
   - Section 2: <section id="exam" data-label="Exam Performance">
     * Inside this section, you MUST wrap the roadmap/plan for EACH technical skill/interest (interests: ${Object.keys(currentTechScores).join(', ')}) in an <article id="exam-[skill-id]" data-label="[Skill Name]"> tag (where [skill-id] is the lowercased, alphanumeric interest name, e.g., exam-algorithms, exam-systemdesign, exam-python).
     * Under each article tag, provide a small summary of recommendations, score assessment, and the matching recommended resource cards from the catalog. For example: <article id="exam-algorithms" data-label="Algorithms"> ... </article>
   - Section 3: <section id="interview" data-label="Mock Interviews">
     * Inside this section, you MUST wrap the roadmap/plan for EACH behavioral/communication category in an <article id="interview-[SkillName]" data-label="[SkillLabel]"> tag.
     * Specifically, use these exact articles:
       - <article id="interview-communication" data-label="Communication & STAR"> ... </article>
       - <article id="interview-visual" data-label="Visual Presence & Posture"> ... </article>
       - <article id="interview-voice" data-label="Voice Control & Fluency"> ... </article>
       - <article id="interview-reasoning" data-label="Reasoning & Logic"> ... </article>
     * Under each article tag, provide a small summary of recommendations, score assessment, and the matching recommended resource cards from the catalog.

IMPORTANT - CARD LAYOUT AND CURATED RESOURCES RULES:
1. DO NOT render any image previews, thumbnail images, or img tags (skip thumbnails completely for all resource cards).
2. Inside each article, use frosted glass layout cards (e.g., div with class "bg-[#111322]/50 border border-white/[0.05] rounded-3xl p-6 mb-6 shadow-xl") to group feedback, suggestions, and learning resources into clear sub-sections.
3. For each skill/interest (whether technical or behavioral), if the candidate's score is less than 75%, you MUST recommend between 2 and 4 relevant links of EACH resource type (meaning 2 to 4 Free Courses, 2 to 4 Paid Courses, and 2 to 4 YouTube Videos/Playlists/Channels) from the Curated Resource Catalog below. The exact number of resources for each type (between 2 and 4) is up to you to decide dynamically based on the candidate's gaps. Do not limit yourself to only 1 of each type.
4. For each recommended resource, display it as a card in a responsive side-by-side grid: <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
5. Inside each grid item, render a beautiful mini resource card with class "bg-[#161826]/40 border border-white/[0.04] p-3.5 rounded-xl flex flex-col justify-between hover:border-teal-500/20 transition-all" containing:
   - A small pill indicator for the resource type (e.g., Free Course, Paid Course, YouTube Video, YouTube Channel). E.g., <span class="self-start px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 mb-1.5">Free Course</span>
   - A compact, bold title (class "text-xs font-semibold text-white mb-1")
   - A brief 1-sentence rationale of how it targets their specific gap (class "text-[10px] text-gray-400 leading-normal mb-2").
   - A direct, clickable link to start learning, styled as a clear CTA button/link: <a href="URL" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors">Start Learning →</a>
6. Crucial: NEVER invent or use dummy URLs (like google.com, example.com). Only output the EXACT URLs provided in the catalog below.

CURATED RESOURCE CATALOG:
${JSON.stringify(REAL_LEARNING_RESOURCES, null, 2)}

Do not use placeholders. Write real, high-quality, professional coaching content.
Do NOT include any footer, signature, copyright notice, or text like "All rights reserved", "Elite AI Career Coach", or "2023" at the end of your response.`;

      const prompt = `Here are the candidate's current scores:
- Technical Skills:
${Object.entries(currentTechScores).map(([k, v]) => `  * ${k}: ${v}%`).join('\n')}
- Behavioral Skills:
  * Communication & STAR: ${currentBehavioralScores.communication}%
  * Visual Presence & Posture: ${currentBehavioralScores.bodyPosture}%
  * Voice Control & Fluency: ${currentBehavioralScores.voiceModulation}%
  * Reasoning & Logic: ${currentBehavioralScores.reasoningLogic}%
- Total Practice Sessions Completed: ${currentSessionCount}

Analyze their strengths, weaknesses, and progress. Write a comprehensive, styled HTML study roadmap.`;

      const gateway = getLLMGateway();
      const res = await gateway.complete({ prompt, system: systemPrompt });
      if (res.ok) {
        const cleanText = cleanRecommendationContent(res.text);

        await db.collection('user_recommendations').updateOne(
          { userId: user._id },
          {
            $set: {
              content: cleanText,
              status: 'ready',
              lastGeneratedAt: new Date(),
              totalSessionsAtLastGeneration: currentSessionCount,
              skillsSnapshotAtLastGeneration: {
                technical: currentTechScores,
                behavioral: currentBehavioralScores
              },
              error: null
            }
          }
        );
      } else {
        throw new Error(res.error.message);
      }
    } catch (err: any) {
      console.error('Background recommendation generation failed:', err);
      await db.collection('user_recommendations').updateOne(
        { userId: user._id },
        {
          $set: {
            status: 'failed',
            error: err.message || 'AI Generation failed.'
          }
        }
      );
    }
  })();
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await getDbForUser(user._id);

    // 1. Get current scores & session count
    const scores = await getUserScores(user._id, db);

    // 2. Fetch last generated recommendation
    const doc = await db.collection('user_recommendations').findOne({ userId: user._id });
    if (doc && doc.content) {
      doc.content = cleanRecommendationContent(doc.content);
    }

    // 3. Determine if first generation is needed
    if (!doc) {
      // First generation, start it
      await db.collection('user_recommendations').updateOne(
        { userId: user._id },
        {
          $set: {
            userId: user._id,
            status: 'generating',
            content: '',
            lastGeneratedAt: new Date(),
            totalSessionsAtLastGeneration: scores.totalSessions,
            skillsSnapshotAtLastGeneration: {
              technical: scores.technicalScores,
              behavioral: scores.behavioralScores
            },
            error: null
          }
        },
        { upsert: true }
      );

      await triggerBackgroundGeneration(user, db, scores.technicalScores, scores.behavioralScores, scores.totalSessions);

      return NextResponse.json({
        success: true,
        recommendation: {
          status: 'generating',
          content: ''
        },
        canReRecommend: false,
        threshold: computeThreshold(scores.totalSessions)
      });
    }

    // 4. Compute if variation exceeds threshold (bypassed in development mode for unlimited testing)
    const threshold = computeThreshold(scores.totalSessions);
    const canReRecommendDev = doc.status !== 'generating';

    return NextResponse.json({
      success: true,
      recommendation: doc,
      canReRecommend: canReRecommendDev,
      threshold
    });
  } catch (error: any) {
    console.error('Fetch Recommendation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await getDbForUser(user._id);

    // 1. Check current status
    const doc = await db.collection('user_recommendations').findOne({ userId: user._id });
    if (doc && doc.status === 'generating') {
      return NextResponse.json({
        success: false,
        message: 'A recommendation is already being generated.'
      }, { status: 400 });
    }

    // 2. Fetch current scores
    const scores = await getUserScores(user._id, db);

    // 3. Verify threshold if previous generation exists (bypassed in development mode for unlimited testing)
    // We allow unlimited updates during development/testing

    // 4. Update status to generating
    await db.collection('user_recommendations').updateOne(
      { userId: user._id },
      {
        $set: {
          status: 'generating',
          error: null
        }
      }
    );

    // 5. Trigger background generation
    await triggerBackgroundGeneration(user, db, scores.technicalScores, scores.behavioralScores, scores.totalSessions);

    return NextResponse.json({
      success: true,
      status: 'generating',
      message: 'Recommendation generation started.'
    });
  } catch (error: any) {
    console.error('Trigger Recommendation Generation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
