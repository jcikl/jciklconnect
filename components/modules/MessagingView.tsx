// Messaging View - 1-to-1, group, and project-specific messaging
import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, Send, Plus, Users, Search, MoreVertical, 
  UserPlus, Hash, Briefcase, Paperclip, Image as ImageIcon, X
} from 'lucide-react';
import { Card, Button, Badge, Modal, useToast } from '../ui/Common';
import { Input, Select } from '../ui/Form';
import { LoadingState } from '../ui/Loading';
import { useMessaging } from '../../hooks/useMessaging';
import { useAuth } from '../../hooks/useAuth';
import { useMembers } from '../../hooks/useMembers';
import { useProjects } from '../../hooks/useProjects';
import { Conversation, Message } from '../../services/messagingService';
import { formatDate, formatTime, formatRelativeTime } from '../../utils/dateUtils';

export const MessagingView: React.FC = () => {
  const [messageContent, setMessageContent] = useState('');
  const [isNewConversationModalOpen, setNewConversationModalOpen] = useState(false);
  const [conversationType, setConversationType] = useState<'direct' | 'group' | 'project'>('direct');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { member } = useAuth();
  const { members, loading: membersLoading } = useMembers();
  const { projects, loading: projectsLoading } = useProjects();
  const {
    conversations,
    messages,
    selectedConversation,
    loading,
    error,
    sendMessage,
    createConversation,
    selectConversation,
  } = useMessaging();
  const { showToast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !selectedConversation?.id) return;

    try {
      await sendMessage(selectedConversation.id, messageContent);
      setMessageContent('');
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleCreateConversation = async () => {
    if (!member) return;

    if (conversationType === 'direct' && selectedParticipants.length !== 1) {
      showToast('Please select exactly one member for direct message', 'error');
      return;
    }

    if (conversationType === 'group' && (!groupName.trim() || selectedParticipants.length < 2)) {
      showToast('Please provide a group name and select at least 2 members', 'error');
      return;
    }

    if (conversationType === 'project' && !selectedProjectId) {
      showToast('Please select a project', 'error');
      return;
    }

    try {
      const participants = conversationType === 'project' && selectedProjectId
        ? (() => {
            const project = projects.find(p => p.id === selectedProjectId);
            return project?.team || [];
          })()
        : [...selectedParticipants, member.id];

      const conversationId = await createConversation(
        conversationType,
        participants,
        conversationType === 'group' ? groupName : undefined,
        conversationType === 'project' ? selectedProjectId : undefined
      );

      // Select the new conversation
      const newConversation = conversations.find(c => c.id === conversationId) || 
        { id: conversationId, type: conversationType, participants, name: groupName, projectId: selectedProjectId } as Conversation;
      await selectConversation(newConversation);

      setNewConversationModalOpen(false);
      setSelectedParticipants([]);
      setGroupName('');
      setSelectedProjectId('');
      setConversationType('direct');
    } catch (err) {
      // Error handled in hook
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      conv.name?.toLowerCase().includes(searchLower) ||
      conv.participants.some(pId => {
        const participant = members.find(m => m.id === pId);
        return participant?.name.toLowerCase().includes(searchLower);
      })
    );
  });

  const getConversationDisplayName = (conv: Conversation): string => {
    if (conv.name) return conv.name;
    if (conv.type === 'direct' && member) {
      const otherParticipantId = conv.participants.find(pId => pId !== member.id);
      const otherParticipant = members.find(m => m.id === otherParticipantId);
      return otherParticipant?.name || 'Unknown';
    }
    if (conv.type === 'project' && conv.projectId) {
      const project = projects.find(p => p.id === conv.projectId);
      return project?.name || 'Project Chat';
    }
    return 'Group Chat';
  };

  const getConversationAvatar = (conv: Conversation): string => {
    if (conv.type === 'project') return '';
    if (conv.type === 'direct' && member) {
      const otherParticipantId = conv.participants.find(pId => pId !== member.id);
      const otherParticipant = members.find(m => m.id === otherParticipantId);
      return otherParticipant?.avatar || '';
    }
    return '';
  };

  const getUnreadCount = (conv: Conversation): number => {
    if (!member || !conv.unreadCount) return 0;
    return conv.unreadCount[member.id] || 0;
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Messages</h2>
          <p className="text-slate-500">Connect with members, teams, and projects</p>
        </div>
        <Button onClick={() => setNewConversationModalOpen(true)}>
          <Plus size={16} className="mr-2" />
          New Conversation
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Conversations List */}
        <Card noPadding className="flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <LoadingState loading={loading} error={error} empty={filteredConversations.length === 0} emptyMessage="No conversations yet">
              <div className="divide-y divide-slate-100">
                {filteredConversations.map(conv => {
                  const unreadCount = getUnreadCount(conv);
                  const isSelected = selectedConversation?.id === conv.id;
                  return (
                    <div
                      key={conv.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        isSelected ? 'bg-jci-blue/10 border-l-4 border-l-jci-blue' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => selectConversation(conv)}
                    >
                      <div className="flex items-start gap-3">
                        {conv.type === 'direct' ? (
                          <img
                            src={getConversationAvatar(conv) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(getConversationDisplayName(conv))}
                            alt={getConversationDisplayName(conv)}
                            className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0"
                          />
                        ) : conv.type === 'project' ? (
                          <div className="w-12 h-12 rounded-full bg-jci-blue/10 flex items-center justify-center flex-shrink-0">
                            <Briefcase className="text-jci-blue" size={20} />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <Users className="text-indigo-600" size={20} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-slate-900 text-sm truncate">
                              {getConversationDisplayName(conv)}
                            </h4>
                            {conv.lastMessage && (
                              <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                {formatRelativeTime(conv.lastMessage.timestamp as Date)}
                              </span>
                            )}
                          </div>
                          {conv.lastMessage && (
                            <p className="text-xs text-slate-500 truncate mb-1">
                              {conv.lastMessage.content}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            {conv.type === 'direct' && <Badge variant="neutral" className="text-xs">Direct</Badge>}
                            {conv.type === 'group' && <Badge variant="info" className="text-xs">Group</Badge>}
                            {conv.type === 'project' && <Badge variant="jci" className="text-xs">Project</Badge>}
                            {unreadCount > 0 && (
                              <Badge variant="error" className="text-xs">
                                {unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </LoadingState>
          </div>
        </Card>

        {/* Messages Area */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          {selectedConversation ? (
            <Card noPadding className="flex flex-col h-full min-h-0">
              {/* Conversation Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedConversation.type === 'direct' ? (
                    <img
                      src={getConversationAvatar(selectedConversation) || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(getConversationDisplayName(selectedConversation))}
                      alt={getConversationDisplayName(selectedConversation)}
                      className="w-10 h-10 rounded-full bg-slate-200"
                    />
                  ) : selectedConversation.type === 'project' ? (
                    <div className="w-10 h-10 rounded-full bg-jci-blue/10 flex items-center justify-center">
                      <Briefcase className="text-jci-blue" size={18} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Users className="text-indigo-600" size={18} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">{getConversationDisplayName(selectedConversation)}</h3>
                    <p className="text-xs text-slate-500">
                      {selectedConversation.type === 'group' && `${selectedConversation.participants.length} members`}
                      {selectedConversation.type === 'project' && 'Project team chat'}
                      {selectedConversation.type === 'direct' && 'Direct message'}
                    </p>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-slate-600">
                  <MoreVertical size={18} />
                </button>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                <LoadingState loading={loading} error={error} empty={messages.length === 0} emptyMessage="No messages yet. Start the conversation!">
                  {messages.map((message, index) => {
                    const isOwnMessage = message.senderId === member?.id;
                    const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
                    
                    return (
                      <div
                        key={message.id || index}
                        className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                      >
                        {showAvatar && !isOwnMessage && (
                          <img
                            src={message.senderAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(message.senderName)}
                            alt={message.senderName}
                            className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0"
                          />
                        )}
                        {showAvatar && isOwnMessage && <div className="w-8 flex-shrink-0" />}
                        <div className={`flex-1 ${isOwnMessage ? 'text-right' : ''}`}>
                          {showAvatar && (
                            <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                              <span className="text-xs font-semibold text-slate-700">{message.senderName}</span>
                              <span className="text-xs text-slate-400">
                                {formatTime(message.createdAt as Date)}
                              </span>
                            </div>
                          )}
                          <div
                            className={`inline-block px-4 py-2 rounded-2xl max-w-[70%] ${
                              isOwnMessage
                                ? 'bg-jci-blue text-white'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </LoadingState>
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-slate-200">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Type a message..."
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                  </div>
                  <Button onClick={handleSendMessage} disabled={!messageContent.trim()}>
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-4 text-slate-300" size={48} />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Select a conversation</h3>
                <p className="text-slate-500 mb-4">Choose a conversation from the list or start a new one</p>
                <Button onClick={() => setNewConversationModalOpen(true)}>
                  <Plus size={16} className="mr-2" />
                  New Conversation
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      <Modal
        isOpen={isNewConversationModalOpen}
        onClose={() => {
          setNewConversationModalOpen(false);
          setSelectedParticipants([]);
          setGroupName('');
          setSelectedProjectId('');
          setConversationType('direct');
        }}
        title="New Conversation"
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Conversation Type"
            value={conversationType}
            onChange={(e) => {
              setConversationType(e.target.value as 'direct' | 'group' | 'project');
              setSelectedParticipants([]);
              setGroupName('');
              setSelectedProjectId('');
            }}
            options={[
              { label: 'Direct Message', value: 'direct' },
              { label: 'Group Chat', value: 'group' },
              { label: 'Project Chat', value: 'project' },
            ]}
          />

          {conversationType === 'project' && (
            <Select
              label="Select Project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              options={projects.map(p => ({ label: p.name, value: p.id }))}
              required
            />
          )}

          {conversationType === 'group' && (
            <Input
              label="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              required
            />
          )}

          {(conversationType === 'direct' || conversationType === 'group') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Members {conversationType === 'direct' ? '(1 required)' : '(2+ required)'}
              </label>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-2">
                {members
                  .filter(m => m.id !== member?.id)
                  .map(m => (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (conversationType === 'direct' && selectedParticipants.length >= 1) {
                              showToast('Direct messages can only have 1 other participant', 'error');
                              return;
                            }
                            setSelectedParticipants([...selectedParticipants, m.id]);
                          } else {
                            setSelectedParticipants(selectedParticipants.filter(id => id !== m.id));
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full" />
                      <span className="text-sm text-slate-900">{m.name}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setNewConversationModalOpen(false);
                setSelectedParticipants([]);
                setGroupName('');
                setSelectedProjectId('');
                setConversationType('direct');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateConversation} className="flex-1">
              Create Conversation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

