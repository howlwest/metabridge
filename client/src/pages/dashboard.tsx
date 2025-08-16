import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { BarChart3, TrendingUp, Euro, Power, Code2, Clock, CheckCircle, XCircle, Activity } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ApiResponse {
  data?: any;
  error?: string;
  endpoint?: string;
  timestamp: string;
  isError: boolean;
}

interface HistoryItem {
  timestamp: string;
  endpoint: string;
  method: string;
  data: any;
  response: any;
  isError: boolean;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [requestHistory, setRequestHistory] = useState<HistoryItem[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<ApiResponse | null>(null);

  // Health check query
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/health"],
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Form states
  const [insightsForm, setInsightsForm] = useState({
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    until: new Date().toISOString().split('T')[0],
    level: "ad"
  });

  const [budgetForm, setBudgetForm] = useState({
    adset_id: "",
    daily_budget_eur: ""
  });

  const [statusForm, setStatusForm] = useState({
    ad_id: "",
    status: ""
  });

  // Mutations
  const insightsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/insights", data),
    onSuccess: (response) => {
      handleApiResponse("/insights", "POST", insightsForm, response, false);
      toast({ title: "Success", description: "Insights retrieved successfully" });
    },
    onError: (error: any) => {
      handleApiResponse("/insights", "POST", insightsForm, error, true);
      toast({ title: "Error", description: "Failed to get insights", variant: "destructive" });
    }
  });

  const budgetMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/adset_budget", data),
    onSuccess: (response) => {
      handleApiResponse("/adset_budget", "POST", budgetForm, response, false);
      toast({ title: "Success", description: "Budget updated successfully" });
      setBudgetForm({ adset_id: "", daily_budget_eur: "" });
    },
    onError: (error: any) => {
      handleApiResponse("/adset_budget", "POST", budgetForm, error, true);
      toast({ title: "Error", description: "Failed to update budget", variant: "destructive" });
    }
  });

  const statusMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ad_status", data),
    onSuccess: (response) => {
      handleApiResponse("/ad_status", "POST", statusForm, response, false);
      toast({ title: "Success", description: "Ad status updated successfully" });
      setStatusForm({ ad_id: "", status: "" });
    },
    onError: (error: any) => {
      handleApiResponse("/ad_status", "POST", statusForm, error, true);
      toast({ title: "Error", description: "Failed to update ad status", variant: "destructive" });
    }
  });

  const handleApiResponse = async (endpoint: string, method: string, requestData: any, response: any, isError: boolean) => {
    const timestamp = new Date().toISOString();
    
    let responseData;
    if (isError) {
      responseData = response;
    } else {
      responseData = await response.json();
    }

    const apiResponse: ApiResponse = {
      data: responseData,
      timestamp,
      isError
    };

    const historyItem: HistoryItem = {
      timestamp: new Date().toLocaleString(),
      endpoint,
      method,
      data: requestData,
      response: responseData,
      isError
    };

    setSelectedResponse(apiResponse);
    setRequestHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10 items
  };

  const handleInsightsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    insightsMutation.mutate(insightsForm);
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    budgetMutation.mutate({
      ...budgetForm,
      daily_budget_eur: parseFloat(budgetForm.daily_budget_eur)
    });
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    statusMutation.mutate(statusForm);
  };

  const clearResponse = () => setSelectedResponse(null);
  const clearHistory = () => setRequestHistory([]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Meta API Bridge</h1>
                <p className="text-sm text-gray-600">Marketing Campaign Management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {healthLoading ? (
                  <LoadingSpinner size="sm" />
                ) : healthData?.ok ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-600">Server Online</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Server Offline</span>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500">
                <span>API {healthData?.version || "v23.0"}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Insights Card */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Campaign Insights</CardTitle>
                    <p className="text-sm text-gray-600">View performance metrics</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInsightsSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="since" className="text-sm font-medium">Start Date</Label>
                      <Input
                        id="since"
                        type="date"
                        value={insightsForm.since}
                        onChange={(e) => setInsightsForm({...insightsForm, since: e.target.value})}
                        required
                        data-testid="input-insights-since"
                      />
                    </div>
                    <div>
                      <Label htmlFor="until" className="text-sm font-medium">End Date</Label>
                      <Input
                        id="until"
                        type="date"
                        value={insightsForm.until}
                        onChange={(e) => setInsightsForm({...insightsForm, until: e.target.value})}
                        required
                        data-testid="input-insights-until"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Level</Label>
                    <Select value={insightsForm.level} onValueChange={(value) => setInsightsForm({...insightsForm, level: value})}>
                      <SelectTrigger data-testid="select-insights-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ad">Ad Level</SelectItem>
                        <SelectItem value="adset">Ad Set Level</SelectItem>
                        <SelectItem value="campaign">Campaign Level</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={insightsMutation.isPending}
                    data-testid="button-submit-insights"
                  >
                    {insightsMutation.isPending ? <LoadingSpinner size="sm" /> : "Get Insights"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Budget Update Card */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Euro className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Update Budget</CardTitle>
                    <p className="text-sm text-gray-600">Modify ad set budgets</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBudgetSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="adset_id" className="text-sm font-medium">Ad Set ID</Label>
                    <Input
                      id="adset_id"
                      placeholder="123456789012345"
                      value={budgetForm.adset_id}
                      onChange={(e) => setBudgetForm({...budgetForm, adset_id: e.target.value})}
                      required
                      data-testid="input-budget-adset-id"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="daily_budget_eur" className="text-sm font-medium">Daily Budget (EUR)</Label>
                    <Input
                      id="daily_budget_eur"
                      type="number"
                      placeholder="50.00"
                      step="0.01"
                      min="0"
                      value={budgetForm.daily_budget_eur}
                      onChange={(e) => setBudgetForm({...budgetForm, daily_budget_eur: e.target.value})}
                      required
                      data-testid="input-budget-amount"
                    />
                    <p className="text-xs text-gray-500 mt-1">Will be converted to cents automatically</p>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={budgetMutation.isPending}
                    data-testid="button-submit-budget"
                  >
                    {budgetMutation.isPending ? <LoadingSpinner size="sm" /> : "Update Budget"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Ad Status Card */}
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Power className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Ad Status</CardTitle>
                    <p className="text-sm text-gray-600">Control ad states</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleStatusSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="ad_id" className="text-sm font-medium">Ad ID</Label>
                    <Input
                      id="ad_id"
                      placeholder="123456789012345"
                      value={statusForm.ad_id}
                      onChange={(e) => setStatusForm({...statusForm, ad_id: e.target.value})}
                      required
                      data-testid="input-status-ad-id"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={statusForm.status} onValueChange={(value) => setStatusForm({...statusForm, status: value})}>
                      <SelectTrigger data-testid="select-ad-status">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="PAUSED">Paused</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={statusMutation.isPending}
                    data-testid="button-submit-status"
                  >
                    {statusMutation.isPending ? <LoadingSpinner size="sm" /> : "Update Status"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Response Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* API Response */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">API Response</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearResponse}
                  data-testid="button-clear-response"
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full">
                {selectedResponse ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Response at {new Date(selectedResponse.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant={selectedResponse.isError ? "destructive" : "default"}>
                        {selectedResponse.isError ? "Error" : "Success"}
                      </Badge>
                    </div>
                    <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap" data-testid="text-api-response">
                      {JSON.stringify(selectedResponse.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Code2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">API responses will appear here</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Request History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Request History</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearHistory}
                  data-testid="button-clear-history"
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full">
                {requestHistory.length > 0 ? (
                  <div className="space-y-3">
                    {requestHistory.map((item, index) => (
                      <div 
                        key={index}
                        className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setSelectedResponse({
                          data: item.response,
                          timestamp: new Date(item.timestamp).toISOString(),
                          isError: item.isError
                        })}
                        data-testid={`history-item-${index}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {item.method} {item.endpoint}
                          </span>
                          <Badge variant={item.isError ? "destructive" : "default"} className="text-xs">
                            {item.isError ? "Error" : "Success"}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">{item.timestamp}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Request history will appear here</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Server Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Server Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-1" data-testid="text-server-port">5000</div>
                <div className="text-sm text-gray-600">Server Port</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-1" data-testid="text-api-version">
                  {healthData?.version || "v23.0"}
                </div>
                <div className="text-sm text-gray-600">Graph API Version</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`text-2xl font-bold mb-1 ${healthData?.ok ? 'text-green-600' : 'text-red-600'}`} data-testid="text-server-status">
                  {healthLoading ? "Checking..." : healthData?.ok ? "Healthy" : "Offline"}
                </div>
                <div className="text-sm text-gray-600">Server Status</div>
              </div>
            </div>

            <Separator className="my-6" />

            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Available Endpoints</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">POST</Badge>
                  <code className="text-sm text-gray-700">/api/insights</code>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Badge variant="outline" className="bg-green-100 text-green-800">POST</Badge>
                  <code className="text-sm text-gray-700">/api/adset_budget</code>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Badge variant="outline" className="bg-orange-100 text-orange-800">POST</Badge>
                  <code className="text-sm text-gray-700">/api/ad_status</code>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Badge variant="outline" className="bg-purple-100 text-purple-800">GET</Badge>
                  <code className="text-sm text-gray-700">/api/health</code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
