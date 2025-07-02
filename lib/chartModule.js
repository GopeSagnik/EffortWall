// lib/chartModule.js
import { DATABASE_ID, COLLECTION_IDS, Query, displayMessage, teamMembers, activityCategories, getOrCreateGuestUserId } from './script.js';

console.log('chartModule.js loaded.');
console.log('Chart object (should be defined):', typeof Chart);
console.log('databases object (expected undefined at top-level, passed as arg):', typeof databases); 

// Register the datalabels plugin globally
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
    console.log('ChartDataLabels plugin registered.');
} else {
    console.error('Chart.js or ChartDataLabels is not defined when trying to register ChartDataLabels plugin. Check index.html script order.');
}

let utilizationChartInstance = null; // To store the Chart.js instance

/**
 * Calculates the number of weekdays (Monday-Friday) between two dates.
 * Excludes Saturdays and Sundays.
 * @param {string} startDateStr - Start date in INSEE-MM-DD format.
 * @param {string} endDateStr - End date in INSEE-MM-DD format.
 * @returns {number} Number of weekdays.
 */
function getWeekdaysBetweenDates(startDateStr, endDateStr) {
    let startDate = new Date(startDateStr);
    let endDate = new Date(endDateStr);
    let count = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday and Not Saturday
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
}

/**
 * Calculates the total number of holiday/leave days for a given team member
 * within a specified date range, excluding weekends.
 * @param {object} databases - The Appwrite Databases instance.
 * @param {string} teamMemberId - The Appwrite ID of the team member.
 * @param {string} filterStartDate - The start date of the filter range (YYYY-MM-DD).
 * @param {string} filterEndDate - The end date of the filter range (YYYY-MM-DD).
 * @returns {Promise<number>} The total holiday/leave days.
 */
async function getHolidayLeaveDaysForMember(databases, teamMemberId, filterStartDate, filterEndDate) {
    const userId = getOrCreateGuestUserId();
    try {
        if (!databases) {
            console.error('Appwrite databases object is undefined in getHolidayLeaveDaysForMember.');
            displayMessage('Appwrite connection error. Please check console.', true);
            return 0;
        }

        const queries = [
            Query.equal('userId', userId),
            Query.equal('teamMember', teamMemberId)
        ];

        if (filterStartDate) queries.push(Query.lessThanEqual('startDate', filterEndDate));
        if (filterEndDate) queries.push(Query.greaterThanEqual('endDate', filterStartDate));


        const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.holidays,
            queries
        );

        let totalHolidayDays = 0;
        const filterStart = new Date(filterStartDate);
        const filterEnd = new Date(filterEndDate);

        response.documents.forEach(holiday => {
            const holidayStart = new Date(holiday.startDate);
            const holidayEnd = new Date(holiday.endDate);

            const overlapStart = new Date(Math.max(filterStart.getTime(), holidayStart.getTime()));
            const overlapEnd = new Date(Math.min(filterEnd.getTime(), holidayEnd.getTime()));

            if (overlapStart <= overlapEnd) {
                totalHolidayDays += getWeekdaysBetweenDates(
                    overlapStart.toISOString().split('T')[0],
                    overlapEnd.toISOString().split('T')[0]
                );
            }
        });
        return totalHolidayDays;

    } catch (error) {
        console.error(`Error fetching holiday leave days for ${teamMemberId}:`, error);
        displayMessage(`Error fetching holiday data: ${error.message}`, true);
        return 0;
    }
}

/**
 * Renders the Resource Utilization % bar chart.
 * @param {Array<string>} labels - Array of labels (e.g., Member Names, "Team").
 * @param {Array<number>} data - Array of utilization percentages.
 */
function renderUtilizationChart(labels, data) {
    const ctx = document.getElementById('utilizationChart');

    if (utilizationChartInstance) {
        utilizationChartInstance.destroy();
    }

    const barColors = [
        '#6A5ACD', // Slate Blue
        '#FF6347', // Tomato
        '#3CB371', // Medium Sea Green
        '#FFD700', // Gold
        '#4682B4', // Steel Blue
        '#DA70D6', // Orchid
        '#8A2BE2'  // Blue Violet
    ];

    utilizationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Utilization %',
                data: data,
                backgroundColor: labels.map((_, i) => barColors[i % barColors.length]),
                borderColor: labels.map((_, i) => barColors[i % barColors.length]),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: (value) => value.toFixed(2) + '%',
                    color: '#e0e0e0',
                    font: {
                        weight: 'bold'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + '%';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(60, 60, 70, 0.3)',
                        drawOnChartArea: true // Ensure grid lines are drawn within chart area, which helps with label positioning
                    },
                    ticks: {
                        color: '#a0a0a0',
                        padding: 5, // Small padding to keep them close to the axis line
                        offset: true, // Keep offset for centering under bars
                        font: {
                            weight: 'bold' // Make X-axis labels bold
                        },
                    },
                    position: 'bottom' // Explicitly set position to bottom
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(60, 60, 70, 0.3)'
                    },
                    ticks: {
                        color: '#a0a0a0',
                        callback: function(value) {
                            return value + '%';
                        },
                        min: -0.1 // A very small negative min to ensure 0% is fully visible if it's still cut
                    }
                }
            },
            // Crucial for pulling labels into the visible chart area
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 10,
                    bottom: 30 // Increased bottom padding significantly to make space for X-axis labels inside the canvas
                }
            }
        }
    });
}


/**
 * Displays an aggregated summary table of time spent by members per activity.
 * @param {object} databases - The Appwrite Databases instance.
 */
export async function displaySummaryTable(databases) {
    const dataContainer = document.getElementById('dataContainer');
    const chartContainer = document.getElementById('utilizationChartContainer');

    if (!dataContainer || !chartContainer) {
        console.error('Data or chart container not found!');
        return;
    }

    dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Loading summary data...</p>';
    chartContainer.classList.add('hidden'); // Hide chart container initially

    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;

    if (!filterStartDate || !filterEndDate) {
        dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Please select a Start Date and End Date to view the summary table.</p>';
        displayMessage('Select a date range for the summary.', false);
        if (utilizationChartInstance) {
            utilizationChartInstance.destroy();
            utilizationChartInstance = null;
        }
        return;
    }

    const userId = getOrCreateGuestUserId();
    const timeEntryQueries = [Query.equal('userId', userId)];
    const holidayQueries = [Query.equal('userId', userId)];

    if (filterStartDate) {
        timeEntryQueries.push(Query.greaterThanEqual('date', filterStartDate));
        holidayQueries.push(Query.lessThanEqual('startDate', filterEndDate));
    }
    if (filterEndDate) {
        holidayQueries.push(Query.greaterThanEqual('endDate', filterStartDate));
        timeEntryQueries.push(Query.lessThanEqual('date', filterEndDate));
    }

    try {
        if (!databases) {
            console.error('Appwrite databases object is undefined in displaySummaryTable (argument missing).');
            displayMessage('Appwrite connection error. Please check console.', true);
            dataContainer.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load summary data due to Appwrite connection issue.</p>';
            return;
        }

        const timeEntriesResponse = await databases.listDocuments(
            DATABASE_ID,
            COLLECTION_IDS.timeEntries,
            timeEntryQueries
        );
        const allTimeEntries = timeEntriesResponse.documents;

        const allTeamMembers = teamMembers; // Global teamMembers from script.js
        const allActivityCategories = activityCategories; // Global activityCategories from script.js

        if (allTeamMembers.length === 0) {
            dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No team members available. Please add some in the Manage tab.</p>';
            if (utilizationChartInstance) {
                utilizationChartInstance.destroy();
                utilizationChartInstance = null;
            }
            return;
        }
        if (allActivityCategories.length === 0) {
            dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No activity categories available. Please add some in the Manage tab.</p>';
            if (utilizationChartInstance) {
                utilizationChartInstance.destroy();
                utilizationChartInstance = null;
            }
            return;
        }


        // Prepare the structure for the summary table data
        const summaryData = {};
        allActivityCategories.forEach(cat => {
            summaryData[cat.name] = { total: 0 };
            allTeamMembers.forEach(member => {
                summaryData[cat.name][member.$id] = 0;
            });
        });

        // Populate summaryData with logged hours
        allTimeEntries.forEach(entry => {
            const memberId = entry.teamMember;
            const activity = entry.activity;
            const hours = entry.hoursSpent;

            if (summaryData[activity] && allActivityCategories.some(c => c.name === activity) && allTeamMembers.some(m => m.$id === memberId)) {
                summaryData[activity][memberId] += hours;
                summaryData[activity].total += hours;
            }
        });

        // Calculate total time utilized per member (sum of hours logged by each member)
        const totalTimeUtilizedByMember = {};
        allTeamMembers.forEach(member => {
            totalTimeUtilizedByMember[member.$id] = 0;
        });
        allTimeEntries.forEach(entry => {
            const memberId = entry.teamMember;
            const hours = entry.hoursSpent;
            if (allTeamMembers.some(m => m.$id === memberId)) {
                totalTimeUtilizedByMember[memberId] += hours;
            }
        });


        // Calculate "Total Time (In Hrs.) - Holiday/Leave" and "Holiday/Leave (In Days)"
        const totalWorkdaysInPeriod = getWeekdaysBetweenDates(filterStartDate, filterEndDate);
        const calculatedMemberHours = {}; // Total available working hours for each member (total hours - holiday/leave)
        const holidayLeaveDays = {};

        await Promise.all(allTeamMembers.map(async member => {
            // Pass 'databases' to getHolidayLeaveDaysForMember
            const memberHolidayDays = await getHolidayLeaveDaysForMember(databases, member.$id, filterStartDate, filterEndDate);
            holidayLeaveDays[member.$id] = memberHolidayDays;

            const actualWorkingDays = totalWorkdaysInPeriod - memberHolidayDays;
            calculatedMemberHours[member.$id] = (member.dailyHours * Math.max(0, actualWorkingDays));
        }));

        // Calculate totals for the last two rows
        const totalCalculatedMemberHours = Object.values(calculatedMemberHours).reduce((sum, val) => sum + val, 0);
        const totalHolidayLeaveDays = Object.values(holidayLeaveDays).reduce((sum, val) => sum + val, 0);


        // --- Generate Table HTML ---
        let tableHtml = `
            <table class="min-w-full bg-gray-700 rounded-md overflow-hidden text-sm summary-table">
                <thead class="bg-gray-600 text-gray-200">
                    <tr>
                        <th class="py-2 px-3 text-left sticky-col">Activities</th>
                        ${allTeamMembers.map(member => `<th class="py-2 px-3 text-left">${member.name}</th>`).join('')}
                        <th class="py-2 px-3 text-left total-col">TOTAL</th>
                    </tr>
                </thead>
                <tbody class="text-gray-300">
        `;

        // Activity rows
        allActivityCategories.forEach((activity, index) => {
            // Determine row class based on index for alternating colors
            const rowClass = (index % 2 === 0) ? 'even-row' : 'odd-row';
            tableHtml += `
                <tr class="border-b border-gray-600 ${rowClass}">
                    <td class="py-2 px-3 sticky-col">${activity.name}</td>
                    ${allTeamMembers.map(member => `<td class="py-2 px-3">${(summaryData[activity.name]?.[member.$id] || 0).toFixed(2)}</td>`).join('')}
                    <td class="py-2 px-3 font-semibold total-col">${(summaryData[activity.name]?.total || 0).toFixed(2)}</td>
                </tr>
            `;
        });

        // Summary rows - Now dynamically calculate totals for the last two rows
        // We need to ensure these rows also follow the alternating pattern.
        // Calculate the starting index for these rows to continue the pattern.
        const nextRowIndex = allActivityCategories.length;

        tableHtml += `
            <tr class="border-b border-gray-600 font-bold text-gray-100 summary-total-row ${(nextRowIndex % 2 === 0) ? 'even-row' : 'odd-row'}">
                <td class="py-2 px-3 sticky-col">Total Time Utilized (In Hrs.)</td>
                ${allTeamMembers.map(member => `<td class="py-2 px-3">${totalTimeUtilizedByMember[member.$id]?.toFixed(2) || '0.00'}</td>`).join('')}
                <td class="py-2 px-3 total-col">${Object.values(totalTimeUtilizedByMember).reduce((sum, val) => sum + val, 0).toFixed(2)}</td>
            </tr>
            <tr class="border-b border-gray-600 font-bold text-gray-100 summary-total-row ${((nextRowIndex + 1) % 2 === 0) ? 'even-row' : 'odd-row'}">
                <td class="py-2 px-3 sticky-col">Total Time (In Hrs.) - Holiday/Leave</td>
                ${allTeamMembers.map(member => `<td class="py-2 px-3">${(calculatedMemberHours[member.$id] || 0).toFixed(2)}</td>`).join('')}
                <td class="py-2 px-3 total-col">${totalCalculatedMemberHours.toFixed(2)}</td>
            </tr>
            <tr class="font-bold text-gray-100 summary-total-row ${((nextRowIndex + 2) % 2 === 0) ? 'even-row' : 'odd-row'}">
                <td class="py-2 px-3 sticky-col">Holiday/Leave (In Days)</td>
                ${allTeamMembers.map(member => `<td class="py-2 px-3">${holidayLeaveDays[member.$id] || 0}</td>`).join('')}
                <td class="py-2 px-3 total-col">${totalHolidayLeaveDays}</td>
            </tr>
        `;

        tableHtml += `
                </tbody>
            </table>
        `;
        dataContainer.innerHTML = tableHtml;
        displayMessage('Summary table loaded successfully!', false);

        // --- Prepare and Render Utilization Chart ---
        const chartLabels = [];
        const chartData = [];
        let totalTeamUtilizedHours = 0;
        let totalTeamAvailableHours = 0;

        allTeamMembers.forEach(member => {
            const utilizedHours = totalTimeUtilizedByMember[member.$id] || 0;
            const availableHours = calculatedMemberHours[member.$id] || 0; // This is (total hours - holiday/leave)

            if (availableHours > 0) {
                const utilization = (utilizedHours / availableHours) * 100;
                chartLabels.push(member.name);
                chartData.push(utilization);
            } else {
                chartLabels.push(member.name);
                chartData.push(0); // 0% utilization if no available hours
            }

            totalTeamUtilizedHours += utilizedHours;
            totalTeamAvailableHours += availableHours;
        });

        // Calculate Team Utilization
        let teamUtilization = 0;
        if (totalTeamAvailableHours > 0) {
            teamUtilization = (totalTeamUtilizedHours / totalTeamAvailableHours) * 100;
        }
        chartLabels.push('Team');
        chartData.push(teamUtilization);

        // Display the chart
        chartContainer.classList.remove('hidden');
        renderUtilizationChart(chartLabels, chartData);


    } catch (error) {
        displayMessage(`Error displaying summary table: ${error.message}`, true);
        console.error('Error displaying summary table:', error);
        dataContainer.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load summary data.</p>';
        // Hide chart and destroy instance on error
        chartContainer.classList.add('hidden');
        if (utilizationChartInstance) {
            utilizationChartInstance.destroy();
            utilizationChartInstance = null;
        }
    }
}
