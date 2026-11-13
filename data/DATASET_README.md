\# TicketIQ – Dataset Documentation



\## 1. Project Overview



TicketIQ is a machine learning-based cinema ticket demand forecasting platform. It predicts ticket demand, occupancy rates and estimated revenue using movie metadata and cinema show records.



\## 2. Real-World Data Sources



\### MovieLens Dataset

\- Source: https://grouplens.org/datasets/movielens/

\- Movies: 9,742 records

\- Ratings: 100,836 records

\- Additional files: tags.csv and links.csv

\- Purpose: Movie ratings, genre information and popularity-related features.



\### TMDB Dataset

\- Source: https://developer.themoviedb.org/docs

\- Status: API integration pending due to a network TLS connection issue.

\- Purpose: Additional movie metadata and popularity information.



\## 3. Synthetic Dataset



The cinema booking dataset is programmatically generated for development and model experimentation.



\### cinemas.csv

Contains simulated cinema identifiers, names, locations and seating capacities.



\### shows.csv

Contains simulated show schedules, movie identifiers, ticket prices, booking counts, occupancy rates and revenue.



\- Target cinemas: 20

\- Simulated period: January 2024 – December 2025

\- Target show records: 100,000+

\- Data source label: synthetic



\## 4. Target Variable



`tickets\_booked`



The model will predict the number of tickets booked for a cinema show.



\## 5. Derived Business Metrics



\- Occupancy Rate = Tickets Booked / Available Seats × 100

\- Revenue = Tickets Booked × Ticket Price



\## 6. Data Limitations



1\. Synthetic bookings do not represent actual customer transactions.

2\. MovieLens ratings are not cinema attendance records.

3\. Movie popularity is estimated using rating volume.

4\. Synthetic booking patterns are generated from predefined assumptions.

5\. Real-world model performance must be validated using actual cinema booking history.



\## 7. Data Usage



Real movie metadata and ratings are used for supporting movie features. Synthetic show records are used for initial model development and testing.



All synthetic records are explicitly labelled to avoid confusing simulated data with real transactions.

