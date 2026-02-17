small feedback,
A few updates regarding the filters:

- I should always see the filter selection for the filters. As of now I can only see listing If I click on
  listings and not Portfolio
- I should always see the filter selection for accounts, as of now I can only see the accounts if not in
  portfolio.
- those points above mean maybe changing the filter format.
- I want to be able to select multiple. multiple accounts and multiple listings.

A single update regarding the montly revenew:

- WE might need to check the current day and if the month is not complete might want to guestimate end of month
  based on where we are in the month for the revenue trend and breakdown. The problem is if we're on February
  8th then the full month of February looks like the revenue is going down while it's just that the month has not
  completed. Ideally what I want is to project how much there will be at the end of the month and make a very
  clear distinction between whats real and whats projected so it's visually in a different color in the graph but
  that it can be seen. Let's make this a toggle option so the user can include proyection or not.

Now the actual future changes we want to make.

We want to think about all the possible analytics we can add and organize them in a new dashboard plan that will be in DASHBOARD.md. The dashboard plan should have different tabs/pages depending on the type of file it's provided and on each page the analytics dashboards and table should be included.

All dashboards should be reactive to the top filters. If I want to filter by listing OR by account.

One example graph is:

- a timeline praph showing a linear revenue per listing per month where the months are in the X axis and the revenew in the Y axis and the listings are the different line.

Let's think about all the possible dashboards and all the possible analytics that should be included in these dashboards.
Let's make sure both the dashboards/pages/tabs are dependent on the data and ONLY enabled if all the data is there. For instance if a file was provided that does not have listings, then the dashboard that displays per listings shouldnt show. For this reason we also need to be very critical about how we name the dashboards.

Also we need to compare to the current dashboard code and make sure we're not deleting important metrics.
I like the idea of keeping the totals and averages at the top like we currently have them.
I also like the warnings that appear when there is duplicate information from the sheets.

Our goal right now is update the DASHBOARD.md with the ideal set of dashboards. We can check the git diff to compare to the previous dashboard plan and see if our changes are for the better.
