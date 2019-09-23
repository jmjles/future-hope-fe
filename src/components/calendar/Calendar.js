import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction"; // needed for dayClick
import swal from "@sweetalert/with-react";
import { connect } from "react-redux";
import MomentUtils from "@date-io/moment";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";

import { firestore, auth } from "../../config/fbConfig.js";
import { userStore } from "../../actions/auth.js";
import MeetingModal from "./MeetingModal";

//analytics
import { event, logPageView } from "../Analytics";

import "../auth/Login.scss";
import "./main.scss";

class Calendar extends React.Component {
  calendarComponentRef = React.createRef();
  state = {
    calendarWeekends: true,
    displayPicker: true,
    meetingParticipant: "",
    events: [],
    changedEvent: {},
    showModal: false,
    clickedMeeting: {
      title: "",
      start: "",
      participantUIDs: "",
      participantNames: ""
    }
  };


  //* Creates listener which pulls meetings containing current user's UID and sets to state.
  //! NOTE: Since the GET is now a listener all setState calls in methods have been deleted
  componentDidMount = () => {
    logPageView();
    const uid = JSON.parse(localStorage.getItem("UID")) || auth.currentUser.uid;
    firestore
      .collection("meetings")
      .where("participantUIDs", "array-contains", uid)
      .onSnapshot(querySnapshot => {
        let events = [];
        // console.log(querySnapshot);
        querySnapshot.forEach(doc => {
          // console.log(doc.data());
          const start = doc.data().start.seconds * 1000;
          events.push({
            title: doc.data().title,
            start: new Date(start),
            id: doc.data().id
          });
        });
        this.setState({
          events: events
        });
      });
  };

  toggleModal = () => {
    this.setState({
      showModal: !this.state.showModal
    });
  };

  //* Adds meeting to Firebase and updates calendar
  addMeeting = async meeting => {


    //* add meeting to firestore

    try {
      //* add blank meeting to firestore
      const meetingRef = firestore.collection("meetings").doc();
      //* gets new meeting ID and inserts it into the record as id
      meeting.id = meetingRef.id;
      //* Updates new firestore doc with meeting to add
      await meetingRef.set(meeting);
      swal(`Your meeting has been created`, {
        icon: "success"
      });
    } catch (err) {
      swal("There was a server error, your meeting could not be created", {
        icon: "warning"
      });
    }
  };

  // Edits current meeting
  editMeeting = async meeting => {
    event("Edit-Meeting", "Edit Current meeting", "Calendar");
    console.log("meeting arg into editMeeting", meeting);
    try {
      //* updating meeting in firebase
      const meetingRef = firestore.collection("meetings").doc(meeting.id);
      await meetingRef.update(meeting);
    } catch (err) {
      swal("There was a server error, your meeting could not be updated", {
        icon: "warning"
      });
    }
  };

  deleteMeeting = async meeting => {
    event("Delete-Meeting", "Delete current meeting", "Calendar");
    try {
      // Alert modal asking if they are sure
      await swal({
        title: "Delete Meeting?",
        text: `Are you sure you want to delete this meeting?`,
        icon: "warning",
        buttons: true,
        dangerMode: false
      }).then(okToDelete => {
        // Checks to see if deletion was confirmed and deletes it
        if (okToDelete) {
          const meetingRef = firestore
            .collection("meetings")
            .doc(meeting.id)
            .delete();
          swal(`Your meeting has been deleted`, {
            icon: "success"
          });
        } else {
          swal("Cancelled, your meeting has not been deleted!");
        }
      });
    } catch (err) {
      swal(`Server error: Your meeting could not be deleted`, {
        icon: "error"
      });
    }
    this.toggleModal();
  };

  render() {
    // console.log("user", this.props.user);
    // console.log("auth", auth.currentUser);
    return (
      <div className="calendar-app">
        <div className="calendar-app-top">
          <h1>Schedule a Meeting</h1>
        </div>
        <div className="calendar">
          <input
            type="text"
            id="datepicker"
            placeholder="Set meeting time..."
          />
          <FullCalendar
            themeSystem="standard"
            defaultView="dayGridMonth"
            header={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
            }}
            buttonText={{
              today: "Today",
              month: "Month",
              week: "Week",
              day: "Day"
            }}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            editable
            ref={this.calendarComponentRef}
            weekends={this.state.calendarWeekends}
            events={this.state.events}
            dateClick={this.handleDateClick}
            eventClick={this.handleEventClick}
            eventDrop={this.handleEventDrop}
            allDayDefault={false}
            handleWindowResize
          />
          <MuiPickersUtilsProvider utils={MomentUtils}>
            <MeetingModal
              toggle={this.toggleModal}
              showModal={this.state.showModal}
              addMeeting={this.addMeeting}
              clickedMeeting={this.state.clickedMeeting}
              editMeeting={this.editMeeting}
              deleteMeeting={this.deleteMeeting}
            />
          </MuiPickersUtilsProvider>
        </div>
      </div>
    );
  }

  //* Handles event drag and drop
  handleEventDrop = async info => {
    try {
      // Verifies intention to drop
      swal({
        title: "Change Meeting Date?",
        text: `Meeting will be changed to ${info.event.start}`,
        icon: "warning",
        buttons: true,
        dangerMode: false
      }).then(async changeDate => {
        // Checks if user verified intention to drop
        if (changeDate) {
          //* updating meeting in firebase
          const meetingRef = firestore
            .collection("meetings")
            .doc(info.event.id);
          const newStart = {
            start: info.event.start
          };
          await meetingRef.update(newStart);
          swal(`Meeting date has been changed to ${info.event.start}`, {
            icon: "success"
          });
        } else {
          swal("Cancelled, your meeting has not been changed!");
        }
      });
    } catch (err) {
      swal("There was a server error, your meeting could not be updated", {
        icon: "warning"
      });
    }
  };

  //* On Event click => Pulls event from firestore and sets it to state, populating and opening MeetingModal
  handleEventClick = async info => {
    event("Meeting-Clicked", "Clicked meeting on calendar", "Calendar");
    const meetingRef = firestore.collection("meetings").doc(info.event.id);
    meetingRef.get().then(doc => {
      const start = new Date(doc.data().start.seconds * 1000);
      this.setState({
        ...this.state,
        clickedMeeting: {
          ...doc.data(),
          start: start
        }
      });
    });
    this.toggleModal();
  };

  //* Populates MeetingModal with clicked date and opens
  //? NOTE Defaults to noon. Can this be improved?
  handleDateClick = async arg => {
    event("Meeting-Date", "Set meeting date", "Calendar");
    let meetingDate = await new Date(
      arg.date.getFullYear(),
      arg.date.getMonth(),
      arg.date.getDate(),
      12,
      0,
      0,
      0
    );
    await this.setState({
      clickedMeeting: {
        start: meetingDate
      }
    });
    this.toggleModal();
  };
}

const mapStateToProps = state => {
  return {
    auth: state.firebase.auth,
    user: state.firebase.profile
  };
};

const mapDispatchToProps = dispatch => {
  return {
    userStore: user => dispatch(userStore(user))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Calendar);
