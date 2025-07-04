// lib/chartModule.js
import { databases, COLLECTION_IDS, Query, displayMessage, teamMembers, getOrCreateGuestUserId, DATABASE_ID, activityCategories } from './script.js'; 

let utilizationChartInstance = null; // To hold the Chart.js instance

/**
 * Displays the summary table and resource utilization chart.
 */
export async function displaySummaryTable() {
    const dataContainer = document.getElementById('dataContainer');
    const chartContainer = document.getElementById('utilizationChartContainer');
    if (!dataContainer || !chartContainer) {
        console.error('Data or chart container not found!');
        return;
    }
    dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Loading summary data...</p>';
    chartContainer.innerHTML = '<h3 class="text-lg font-semibold text-gray-100 mb-4 text-center">Resource Utilization %</h3><canvas id="utilizationChart"></canvas>';

    const filterStartDateInput = document.getElementById('filterStartDate').value;
    const filterEndDateInput = document.getElementById('filterEndDate').value;

    let periodStartDate = null;
    let periodEndDate = null;

    // Determine period dates based on filter inputs
    if (filterStartDateInput) {
        periodStartDate = new Date(filterStartDateInput);
        periodStartDate.setHours(0, 0, 0, 0);
    }
    if (filterEndDateInput) {
        periodEndDate = new Date(filterEndDateInput);
        periodEndDate.setHours(23, 59, 59, 999);
    }

    const queries = [];
    // Only add date queries if both start and end dates are provided
    if (periodStartDate && periodEndDate) {
        queries.push(Query.greaterThanEqual('date', periodStartDate.toISOString().split('T')[0]));
        queries.push(Query.lessThanEqual('date', periodEndDate.toISOString().split('T')[0]));
    }

    queries.push(Query.orderAsc('date')); 

    try {
        const timeEntriesResponse = await databases.listDocuments(
            DATABASE_ID, 
            COLLECTION_IDS.timeEntries,
            queries // Will be empty if no date filters, fetching all
        );

        const holidayQueries = [];
        // Only add date queries for holidays if both start and end dates are provided
        if (periodStartDate && periodEndDate) {
            holidayQueries.push(Query.lessThanEqual('startDate', periodEndDate.toISOString().split('T')[0])); 
            holidayQueries.push(Query.greaterThanEqual('endDate', periodStartDate.toISOString().split('T')[0])); 
        }
        holidayQueries.push(Query.limit(100)); // Still apply limit

        const holidaysResponse = await databases.listDocuments(
            DATABASE_ID, 
            COLLECTION_IDS.holidays,
            holidayQueries
        );

        if (timeEntriesResponse.documents.length === 0 && holidaysResponse.documents.length === 0) {
            dataContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No time entries or holiday records found for the selected period.</p>';
            displayMessage('No summary data found for filters.', false);
            if (utilizationChartInstance) {
                utilizationChartInstance.destroy(); 
                utilizationChartInstance = null;
            }
            return;
        }

        // --- Aggregate data for Activity vs. Team Member table and Utilization ---
        const activityMemberHours = {}; // { activityName: { teamMemberId: totalHours } }
        const utilizationSummary = {}; // { teamMemberId: { totalHours: X, totalAvailableHours: Y, totalHolidayHours: Z, totalHolidayDays: D, effectiveAvailableHours: E } }
        const dailyHoursMap = new Map(teamMembers.map(m => [m.$id, m.dailyHours]));

        // Initialize utilizationSummary for all team members
        teamMembers.forEach(member => {
            utilizationSummary[member.$id] = { totalHours: 0, totalAvailableHours: 0, totalHolidayHours: 0, totalHolidayDays: 0, effectiveAvailableHours: 0 };
        });

        // Calculate total hours logged per team member and for pivot table
        timeEntriesResponse.documents.forEach(entry => {
            const activityName = entry.activity;
            const teamMemberId = entry.teamMember;
            const hours = entry.hoursSpent;

            // For pivot table
            if (!activityMemberHours[activityName]) {
                activityMemberHours[activityName] = {};
            }
            if (!activityMemberHours[activityName][teamMemberId]) {
                activityMemberHours[activityName][teamMemberId] = 0;
            }
            activityMemberHours[activityName][teamMemberId] += hours;

            // For utilization summary
            if (utilizationSummary[teamMemberId]) { 
                utilizationSummary[teamMemberId].totalHours += hours;
            }
        });

        // Calculate holiday hours and days per team member for the filtered period
        if (periodStartDate && periodEndDate) { 
            holidaysResponse.documents.forEach(holiday => {
                const holidayStartDate = new Date(holiday.startDate);
                const holidayEndDate = new Date(holiday.endDate);
                const memberId = holiday.teamMember;
                const dailyHours = dailyHoursMap.get(memberId) || 0; 

                if (!utilizationSummary[memberId]) {
                    utilizationSummary[memberId] = { totalHours: 0, totalAvailableHours: 0, totalHolidayHours: 0, totalHolidayDays: 0, effectiveAvailableHours: 0 };
                }

                const effectiveStartDate = new Date(Math.max(holidayStartDate.getTime(), periodStartDate.getTime()));
                const effectiveEndDate = new Date(Math.min(holidayEndDate.getTime(), periodEndDate.getTime()));

                if (effectiveStartDate <= effectiveEndDate) {
                    let days = 0;
                    for (let d = new Date(effectiveStartDate); d <= effectiveEndDate; d.setDate(d.getDate() + 1)) {
                        if (d.getDay() !== 0 && d.getDay() !== 6) { // 0 = Sunday, 6 = Saturday
                            days++;
                        }
                    }
                    utilizationSummary[memberId].totalHolidayDays += days;
                    utilizationSummary[memberId].totalHolidayHours += days * dailyHours;
                }
            });
        }


        // Calculate total working days in the period
        let totalWorkingDaysInPeriod = 0;
        if (periodStartDate && periodEndDate) { 
            for (let d = new Date(periodStartDate); d <= periodEndDate; d.setDate(d.getDate() + 1)) {
                if (d.getDay() !== 0 && d.getDay() !== 6) { // Count weekdays
                    totalWorkingDaysInPeriod++;
                }
            }
        } else {
            displayMessage('For accurate utilization, please select a date range. Showing all data with 0 available hours for utilization calculation.', false);
        }

        // Calculate total available hours and effective available hours per team member
        teamMembers.forEach(member => {
            if (utilizationSummary[member.$id]) {
                utilizationSummary[member.$id].totalAvailableHours = totalWorkingDaysInPeriod * member.dailyHours;
                utilizationSummary[member.$id].effectiveAvailableHours = utilizationSummary[member.$id].totalAvailableHours - utilizationSummary[member.$id].totalHolidayHours;
            }
        });


        // --- Prepare the Activity vs. Team Member pivot table HTML ---
        let pivotTableHtml = `
            <h3 class="text-lg font-semibold text-gray-100 mb-4 text-center">Team Utilizations</h3>
            <table class="min-w-full bg-gray-700 rounded-md overflow-hidden text-sm mb-8">
                <thead class="bg-gray-600 text-gray-200">
                    <tr>
                        <th class="py-2 px-3 text-left">Activity</th>
                        ${teamMembers.map(member => `<th class="py-2 px-3 text-left">${member.name}</th>`).join('')}
                        <th class="py-2 px-3 text-left">Total Activity Hours</th>
                    </tr>
                </thead>
                <tbody class="text-gray-300">
        `;

        let grandTotalLoggedHours = 0;
        activityCategories.forEach(category => {
            const activityName = category.name;
            let totalActivityHours = 0;
            pivotTableHtml += `<tr><td class="py-2 px-3 font-semibold">${activityName}</td>`;
            
            teamMembers.forEach(member => {
                const hours = activityMemberHours[activityName]?.[member.$id] || 0;
                pivotTableHtml += `<td class="py-2 px-3">${hours.toFixed(2)}</td>`;
                totalActivityHours += hours;
            });
            pivotTableHtml += `<td class="py-2 px-3 font-bold">${totalActivityHours.toFixed(2)}</td></tr>`;
            grandTotalLoggedHours += totalActivityHours;
        });

        // --- Summary Rows ---
        // 3rd Last: Total Time Utilized (in Hrs.)
        pivotTableHtml += `
            <tr class="border-t-2 border-gray-500 font-bold text-blue-300 bg-gray-600"> 
                <td class="py-2 px-3">Total Time Utilized (in Hrs.)</td>
                ${teamMembers.map(member => {
                    return `<td class="py-2 px-3">${(utilizationSummary[member.$id]?.totalHours || 0).toFixed(2)}</td>`;
                }).join('')}
                <td class="py-2 px-3">${grandTotalLoggedHours.toFixed(2)}</td>
            </tr>
        `;

        // 2nd Last: Total Time (in Hrs.) - Holiday/Leave (This is effective available hours)
        pivotTableHtml += `
            <tr class="border-t border-gray-600 font-bold text-green-300 bg-gray-600"> 
                <td class="py-2 px-3">Total Time (in Hrs.) - Holiday/Leave</td>
                ${teamMembers.map(member => {
                    const effectiveAvailable = utilizationSummary[member.$id]?.effectiveAvailableHours || 0;
                    return `<td class="py-2 px-3">${effectiveAvailable.toFixed(2)}</td>`; 
                }).join('')}
                <td class="py-2 px-3">${Object.values(utilizationSummary).reduce((sum, s) => sum + (s.effectiveAvailableHours || 0), 0).toFixed(2)}</td>
            </tr>
        `;

        // Last: Holiday Count (Days)
        pivotTableHtml += `
            <tr class="border-t-2 border-gray-500 font-bold text-yellow-300 bg-gray-600"> 
                <td class="py-2 px-3">Holiday Count (Days)</td>
                ${teamMembers.map(member => {
                    return `<td class="py-2 px-3">${(utilizationSummary[member.$id]?.totalHolidayDays || 0).toFixed(0)}</td>`; 
                }).join('')}
                <td class="py-2 px-3">${Object.values(utilizationSummary).reduce((sum, s) => sum + s.totalHolidayDays, 0).toFixed(0)}</td>
            </tr>
        `;

        pivotTableHtml += `
                </tbody>
            </table>
        `;
        dataContainer.innerHTML = pivotTableHtml; // Set the new pivot table

        // --- Render Resource Utilization Chart ---
        const ctx = document.getElementById('utilizationChart').getContext('2d');
        if (utilizationChartInstance) {
            utilizationChartInstance.destroy(); 
        }

        const chartLabels = [];
        const chartData = [];
        const chartColors = [];

        // Calculate overall team utilization for the "Team" bar
        const overallTeamLoggedHours = Object.values(utilizationSummary).reduce((sum, s) => sum + s.totalHours, 0);
        const overallTeamEffectiveAvailableHours = Object.values(utilizationSummary).reduce((sum, s) => sum + s.effectiveAvailableHours, 0);
        const overallTeamUtilization = overallTeamEffectiveAvailableHours > 0 ? (overallTeamLoggedHours / overallTeamEffectiveAvailableHours) * 100 : 0;


        // Add individual team members to chart data
        teamMembers.forEach(member => {
            const memberUtilizationSummary = utilizationSummary[member.$id] || { totalHours: 0, effectiveAvailableHours: 0 };
            const utilization = memberUtilizationSummary.effectiveAvailableHours > 0 ? (memberUtilizationSummary.totalHours / memberUtilizationSummary.effectiveAvailableHours) * 100 : 0;

            chartLabels.push(member.name);
            chartData.push(utilization.toFixed(2));
            // Assign specific colors based on the screenshot, or a default if not specified
            // These are approximations based on the screenshot.
            if (member.name === 'Nandini') chartColors.push('#6A5ACD'); 
            else if (member.name === 'Rajesh') chartColors.push('#FF6347'); 
            else if (member.name === 'Rishav') chartColors.push('#3CB371'); 
            else if (member.name === 'Sagnik') chartColors.push('#FFD700'); 
            else if (member.name === 'Umesh') chartColors.push('#4682B4'); 
            else chartColors.push('#3b82f6'); 
        });

        // Add "Team" bar to chart data
        chartLabels.push('Team');
        chartData.push(overallTeamUtilization.toFixed(2));
        chartColors.push('#DA70D6'); 

        // Define a consistent dark yellow color for all text elements
        const TEXT_COLOR = '#E6B800'; // Darker Yellow
        const STROKE_COLOR = '#000000'; // Black stroke for contrast

        utilizationChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Utilization %',
                    data: chartData,
                    backgroundColor: chartColors,
                    borderWidth: 0 
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                backgroundColor: 'rgba(50, 0, 0, 1.2)', // Dark, semi-transparent background for the chart area
                plugins: {
                    legend: {
                        display: false, 
                    },
                    title: {
                        display: false, 
                    },
                    datalabels: {
                        anchor: 'end', 
                        align: 'end',   
                        offset: 4,      
                        formatter: (value) => value + '%',
                        color: TEXT_COLOR, // <-- Using consistent TEXT_COLOR
                        font: {
                            weight: 'bold'
                        },
                        textStrokeColor: STROKE_COLOR, // <-- Using consistent STROKE_COLOR
                        textStrokeWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)', 
                            drawOnChartArea: true, 
                            drawBorder: false 
                        },
                        ticks: {
                            color: TEXT_COLOR, // <-- Using consistent TEXT_COLOR
                            font: {
                                size: 12,
                                weight: 'bold' 
                            },
                            padding: 20 
                        },
                        barPercentage: 0.8, 
                        categoryPercentage: 0.8 
                    },
                    y: {
                        beginAtZero: true,
                        max: 100, 
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)', 
                            drawOnChartArea: true,
                            drawBorder: false 
                        },
                        ticks: {
                            color: TEXT_COLOR, // <-- Using consistent TEXT_COLOR
                            callback: function(value) {
                                return value + '%';
                            },
                            stepSize: 10,
                            font: {
                                weight: 'bold' 
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                layout: {
                    padding: {
                        top: 20,
                        bottom: 40 
                    }
                }
            },
            plugins: [ChartDataLabels] 
        });

        displayMessage(`Displayed summary for ${teamMembers.length} team members.`, false);

    } catch (error) {
        displayMessage(`Error displaying summary: ${error.message}`, true);
        console.error('Error displaying summary:', error);
        dataContainer.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load summary data.</p>';
        if (utilizationChartInstance) {
            utilizationChartInstance.destroy();
            utilizationChartInstance = null;
        }
    }
}
